import { supabase } from '@/lib/customSupabaseClient';
import { mediaQueue } from '@/lib/offlineInspectionMediaQueue';
import {
  normalizeInspectionImageFile,
  validateInspectionImageFile,
} from '@/lib/imageCompression';

export const INSPECTION_PHOTO_BUCKET = 'inspection-photos';

const asText = (value) => (typeof value === 'string' ? value.trim() : '');

const sha256Hex = async (blob) => {
  const bytes = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const isObjectAlreadyPresentError = (error) => {
  const message = `${error?.message || ''} ${error?.error || ''}`.toLowerCase();
  return message.includes('already exists') || message.includes('duplicate');
};

const uploadNormalizedObject = async ({ objectPath, blob }) => {
  const upload = await supabase.storage.from(INSPECTION_PHOTO_BUCKET).upload(objectPath, blob, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (!upload.error) return;
  if (!isObjectAlreadyPresentError(upload.error)) throw upload.error;

  // A prior attempt may have uploaded successfully before the browser was interrupted.
  // Only accept the existing object when its bytes match this deterministic retry.
  const existing = await supabase.storage.from(INSPECTION_PHOTO_BUCKET).download(objectPath);
  if (existing.error || !existing.data) throw upload.error;
  const [existingHash, retryHash] = await Promise.all([sha256Hex(existing.data), sha256Hex(blob)]);
  if (existingHash !== retryHash) {
    throw new Error('A different image already exists at this evidence path.');
  }
};

const ensureEvidenceRow = async ({
  item,
  tenantId,
  inspectionId,
  revision,
  technicianId,
  userId,
}) => {
  const photoRowId = item.photo_row_id || item.id;
  const objectPath = item.object_path || `${tenantId}/inspections/${inspectionId}/revision-${revision}/photos/${photoRowId}.jpg`;

  const existing = await supabase
    .from('inspection_photos')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('inspection_id', inspectionId)
    .eq('id', photoRowId)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) {
    if (existing.data.object_path !== objectPath) {
      throw new Error('Queued image path does not match the persisted evidence path.');
    }
    return { photoRow: existing.data, photoRowId, objectPath: existing.data.object_path };
  }

  const nowIso = new Date().toISOString();
  const inserted = await supabase
    .from('inspection_photos')
    .insert({
      id: photoRowId,
      tenant_id: tenantId,
      inspection_id: inspectionId,
      finding_id: item.finding_id || null,
      recommendation_id: item.recommendation_id || null,
      technician_id: technicianId || null,
      created_by_user_id: userId || null,
      bucket_id: INSPECTION_PHOTO_BUCKET,
      object_path: objectPath,
      file_name: item.file_name || null,
      content_type: 'image/jpeg',
      byte_size: null,
      caption: asText(item.caption) || null,
      category: asText(item.category) || null,
      is_before: typeof item.is_before === 'boolean' ? item.is_before : null,
      quality_status: item.quality_status || 'unchecked',
      quality_warnings: item.quality_warnings || [],
      quality_metrics: item.quality_metrics || {},
      quality_checked_at: item.quality_checked_at || null,
      taken_at: item.taken_at || null,
      upload_state: 'pending',
      storage_error: null,
      storage_uploaded_at: null,
      uploaded_at: nowIso,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select('*')
    .single();
  if (inserted.error) throw inserted.error;
  return { photoRow: inserted.data, photoRowId, objectPath };
};

export const enqueueInspectionPhotoFiles = async ({
  files,
  tenantId,
  inspectionId,
  revision,
  isBefore = null,
  qualityResults = new Map(),
}) => {
  const accepted = [];
  const rejected = [];

  for (const file of Array.from(files || [])) {
    try {
      validateInspectionImageFile(file);
      const id = crypto.randomUUID();
      const item = await mediaQueue.add({
        id,
        tenant_id: tenantId,
        inspection_id: inspectionId,
        inspection_revision: revision,
        status: 'queued',
        stage: 'queued',
        progress: 0,
        photo_row_id: id,
        object_path: `${tenantId}/inspections/${inspectionId}/revision-${revision}/photos/${id}.jpg`,
        file,
        file_name: file?.name || `photo-${id}`,
        original_content_type: file?.type || null,
        caption: '',
        finding_id: null,
        recommendation_id: null,
        is_before: typeof isBefore === 'boolean' ? isBefore : null,
        quality_status: qualityResults.get(file)?.status || 'unchecked',
        quality_warnings: qualityResults.get(file)?.warnings || [],
        quality_metrics: qualityResults.get(file)?.metrics || {},
        quality_checked_at: qualityResults.get(file) ? new Date().toISOString() : null,
      });
      accepted.push(item);
    } catch (error) {
      rejected.push({ fileName: file?.name || 'image', error: error?.message || 'Unsupported image.' });
    }
  }

  return { accepted, rejected };
};

export const flushInspectionPhotoQueue = async ({
  tenantId,
  inspectionId,
  revision,
  technicianId,
  userId,
  onQueueChange,
  onPhotoComplete,
}) => {
  const refresh = async () => {
    const rows = await mediaQueue.list({ tenantId, inspectionId });
    onQueueChange?.(rows);
    return rows;
  };

  const attempted = new Set();
  let local = await refresh();
  while (true) {
    const next = local.find((item) => (
      (item.status === 'queued' || item.status === 'failed') && !attempted.has(item.id)
    ));
    if (!next) break;
    attempted.add(next.id);

    await mediaQueue.patch(next.id, { status: 'uploading', stage: 'preparing', progress: 10, error: null });
    await refresh();

    let photoRowId = next.photo_row_id || next.id;
    try {
      if (!next.file) throw new Error('Missing queued image. Select the photo again.');

      const evidence = await ensureEvidenceRow({
        item: next,
        tenantId,
        inspectionId,
        revision,
        technicianId,
        userId,
      });
      photoRowId = evidence.photoRowId;
      await mediaQueue.patch(next.id, {
        photo_row_id: evidence.photoRowId,
        object_path: evidence.objectPath,
        stage: 'normalizing',
        progress: 25,
      });
      await refresh();

      const normalized = await normalizeInspectionImageFile(next.file, {
        maxDimension: 1800,
        targetMaxBytes: 850_000,
        startQuality: 0.86,
        minQuality: 0.55,
      });
      await mediaQueue.patch(next.id, { stage: 'uploading', progress: 65 });
      await refresh();

      await uploadNormalizedObject({ objectPath: evidence.objectPath, blob: normalized.blob });
      await mediaQueue.patch(next.id, { stage: 'finalizing', progress: 90 });
      await refresh();

      const updated = await supabase
        .from('inspection_photos')
        .update({
          content_type: 'image/jpeg',
          byte_size: normalized.normalizedBytes,
          upload_state: 'complete',
          storage_error: null,
          storage_uploaded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('inspection_id', inspectionId)
        .eq('id', evidence.photoRowId)
        .select('*')
        .single();
      if (updated.error) throw updated.error;

      await mediaQueue.remove(next.id);
      await onPhotoComplete?.(updated.data, normalized);
    } catch (error) {
      const message = error?.message || 'Image normalization or upload failed.';
      if (photoRowId) {
        await supabase
          .from('inspection_photos')
          .update({ upload_state: 'failed', storage_error: message, updated_at: new Date().toISOString() })
          .eq('tenant_id', tenantId)
          .eq('inspection_id', inspectionId)
          .eq('id', photoRowId)
          .then(() => null)
          .catch(() => null);
      }
      await mediaQueue.patch(next.id, { status: 'failed', stage: 'failed', progress: 0, error: message });
    }

    local = await refresh();
  }

  return refresh();
};
