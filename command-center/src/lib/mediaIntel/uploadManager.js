import { Upload } from 'tus-js-client';
import { supabase } from '@/lib/customSupabaseClient';
import { MIL_ORIGINALS_BUCKET } from './constants';
import { sha256Hex, clientFileKey } from './checksum';
import { mediaKindFromMime, resolveMimeType, safeStorageSegment, validateMediaFile } from './formats';
import { saveUploadSession } from './uploadSessionStore';
import { createImageGridThumb } from './derivatives';

const TUS_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/upload/resumable`;

function uuid() {
  return crypto.randomUUID();
}

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data?.session?.access_token;
  if (!token) throw new Error('Sign in required to upload media.');
  return token;
}

async function findExactDuplicate(checksum) {
  const { data, error } = await supabase
    .from('mil_assets')
    .select('id, original_filename, original_path, created_at')
    .eq('checksum_sha256', checksum)
    .is('archived_at', null)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function refreshBatchCounts(batchId) {
  const { data: rows, error } = await supabase
    .from('mil_manifest_entries')
    .select('upload_status')
    .eq('batch_id', batchId);
  if (error) throw error;

  const counts = { success: 0, failed: 0, skipped: 0, duplicate: 0 };
  for (const row of rows || []) {
    if (row.upload_status === 'uploaded') counts.success += 1;
    else if (row.upload_status === 'failed') counts.failed += 1;
    else if (row.upload_status === 'skipped') counts.skipped += 1;
    else if (row.upload_status === 'duplicate') counts.duplicate += 1;
  }

  await supabase
    .from('mil_upload_batches')
    .update({
      success_count: counts.success,
      failed_count: counts.failed,
      skipped_count: counts.skipped,
      duplicate_count: counts.duplicate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', batchId);

  return counts;
}

async function writeAudit({ action, targetType, targetId, details }) {
  const { data: auth } = await supabase.auth.getUser();
  await supabase.from('mil_audit_events').insert({
    actor_user_id: auth?.user?.id || null,
    action,
    target_type: targetType,
    target_id: targetId,
    details: details || {},
  });
}

export async function createUploadBatch({ sourceLabel, sourcePhone, sourcePerson, clientSessionKey }) {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('mil_upload_batches')
    .insert({
      source_label: sourceLabel || null,
      source_phone: sourcePhone || null,
      source_person: sourcePerson || null,
      uploader_user_id: auth?.user?.id || null,
      status: 'open',
      client_session_key: clientSessionKey || uuid(),
    })
    .select('*')
    .single();
  if (error) throw error;

  await writeAudit({
    action: 'upload_batch_created',
    targetType: 'mil_upload_batches',
    targetId: data.id,
    details: { sourceLabel, sourcePhone, sourcePerson },
  });

  return data;
}

function tusUpload({ file, objectPath, mime, token, onProgress, signalController }) {
  return new Promise((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: TUS_ENDPOINT,
      retryDelays: [0, 1000, 3000, 5000, 10000],
      headers: { authorization: `Bearer ${token}`, 'x-upsert': 'false' },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: MIL_ORIGINALS_BUCKET,
        objectName: objectPath,
        contentType: mime,
        cacheControl: '3600',
      },
      chunkSize: 6 * 1024 * 1024,
      onError(error) { reject(error); },
      onProgress(bytesUploaded, bytesTotal) {
        onProgress?.({
          bytesUploaded,
          bytesTotal,
          percent: bytesTotal ? Math.round((bytesUploaded / bytesTotal) * 100) : 0,
        });
      },
      onSuccess() { resolve(upload.url); },
    });

    signalController.abort = () => {
      try { upload.abort(true); } catch { /* ignore */ }
      reject(new Error('Upload cancelled'));
    };
    signalController.pause = () => upload.abort();
    signalController.resume = () => upload.start();

    upload.findPreviousUploads().then((previous) => {
      if (previous?.length) upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    }).catch(() => upload.start());
  });
}

export async function uploadFilesToBatch({ batch, files, onFileUpdate, controllersRef }) {
  const token = await getAccessToken();
  const { data: auth } = await supabase.auth.getUser();
  const sessionKey = batch.client_session_key || batch.id;

  await supabase.from('mil_upload_batches').update({ status: 'uploading' }).eq('id', batch.id);

  const fileList = Array.from(files || []);
  for (let i = 0; i < fileList.length; i += 1) {
    const file = fileList[i];
    const key = clientFileKey(file);
    const validation = validateMediaFile(file);
    const mime = validation.ok ? validation.mime : resolveMimeType(file);
    const assetId = uuid();
    const objectPath = `mil/originals/${batch.id}/${assetId}/${safeStorageSegment(file.name)}`;

    let manifestId = null;
    const emit = (patch) => onFileUpdate?.({ clientKey: key, filename: file.name, ...patch });

    try {
      if (!validation.ok) {
        const { data: entry } = await supabase
          .from('mil_manifest_entries')
          .insert({
            batch_id: batch.id,
            original_filename: file.name,
            mime_type: mime,
            byte_size: file.size,
            upload_status: 'skipped',
            client_file_key: key,
            error_message: validation.reason,
          })
          .select('id')
          .single();
        manifestId = entry?.id;
        emit({ status: 'skipped', message: validation.reason });
        continue;
      }

      emit({ status: 'hashing', percent: 0 });
      const checksum = await sha256Hex(file);
      const dup = await findExactDuplicate(checksum);
      if (dup) {
        await supabase.from('mil_manifest_entries').insert({
          batch_id: batch.id,
          asset_id: dup.id,
          original_filename: file.name,
          mime_type: mime,
          byte_size: file.size,
          checksum_sha256: checksum,
          upload_status: 'duplicate',
          duplicate_status: 'exact',
          client_file_key: key,
          error_message: `Exact duplicate of ${dup.original_filename}`,
        });
        emit({ status: 'duplicate', message: 'Exact duplicate of existing asset', percent: 100 });
        continue;
      }

      const { data: manifest, error: manifestErr } = await supabase
        .from('mil_manifest_entries')
        .insert({
          batch_id: batch.id,
          original_filename: file.name,
          mime_type: mime,
          byte_size: file.size,
          checksum_sha256: checksum,
          upload_status: 'uploading',
          client_file_key: key,
        })
        .select('*')
        .single();
      if (manifestErr) throw manifestErr;
      manifestId = manifest.id;

      const controller = { abort() {}, pause() {}, resume() {} };
      if (controllersRef) controllersRef.current[key] = controller;

      emit({ status: 'uploading', percent: 0 });
      const tusUrl = await tusUpload({
        file, objectPath, mime, token, signalController: controller,
        onProgress: (p) => emit({ status: 'uploading', percent: p.percent }),
      });

      const { data: asset, error: assetErr } = await supabase
        .from('mil_assets')
        .insert({
          id: assetId,
          batch_id: batch.id,
          media_kind: mediaKindFromMime(mime),
          mime_type: mime,
          byte_size: file.size,
          checksum_sha256: checksum,
          original_filename: file.name,
          original_bucket: MIL_ORIGINALS_BUCKET,
          original_path: objectPath,
          processing_status: 'queued',
          human_review_status: 'pending',
          privacy_status: 'needs_review',
          created_by_user_id: auth?.user?.id || null,
        })
        .select('*')
        .single();
      if (assetErr) throw assetErr;

      await supabase
        .from('mil_manifest_entries')
        .update({
          asset_id: asset.id,
          upload_status: 'uploaded',
          processing_status: 'queued',
          tus_upload_url: tusUrl || null,
        })
        .eq('id', manifestId);

      await supabase.from('mil_processing_jobs').insert({
        asset_id: asset.id,
        batch_id: batch.id,
        job_type: 'ai_analyze',
        status: 'queued',
      });

      try {
        await createImageGridThumb({ assetId: asset.id, file });
      } catch (thumbErr) {
        console.warn('MIL grid thumb skipped', thumbErr);
      }

      await writeAudit({
        action: 'upload',
        targetType: 'mil_assets',
        targetId: asset.id,
        details: { batchId: batch.id, filename: file.name, checksum },
      });

      emit({ status: 'uploaded', percent: 100, assetId: asset.id });
    } catch (err) {
      const message = err?.message || 'Upload failed';
      if (manifestId) {
        const { data: prior } = await supabase
          .from('mil_manifest_entries')
          .select('retry_count')
          .eq('id', manifestId)
          .maybeSingle();
        await supabase
          .from('mil_manifest_entries')
          .update({
            upload_status: message.includes('cancelled') ? 'cancelled' : 'failed',
            error_message: message,
            retry_count: (prior?.retry_count || 0) + 1,
          })
          .eq('id', manifestId);
      } else {
        await supabase.from('mil_manifest_entries').insert({
          batch_id: batch.id,
          original_filename: file.name,
          mime_type: mime,
          byte_size: file.size,
          upload_status: 'failed',
          client_file_key: key,
          error_message: message,
        });
      }
      emit({ status: 'failed', message });
    }

    await saveUploadSession({ sessionKey, batchId: batch.id, updatedAt: Date.now() });
  }

  const counts = await refreshBatchCounts(batch.id);
  const done = counts.failed === 0 ? 'completed' : 'interrupted';
  await supabase
    .from('mil_upload_batches')
    .update({
      status: done,
      completed_at: done === 'completed' ? new Date().toISOString() : null,
    })
    .eq('id', batch.id);

  return counts;
}

export async function fetchBatchManifest(batchId) {
  const [{ data: batch }, { data: entries }] = await Promise.all([
    supabase.from('mil_upload_batches').select('*').eq('id', batchId).single(),
    supabase.from('mil_manifest_entries').select('*').eq('batch_id', batchId).order('created_at', { ascending: true }),
  ]);
  return { batch, entries: entries || [] };
}
