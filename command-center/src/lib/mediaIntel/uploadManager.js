/**
 * Media Intelligence upload client.
 *
 * The browser no longer writes anything to the library. It cannot: INSERT,
 * UPDATE and DELETE on mil_upload_batches / mil_upload_grants /
 * mil_manifest_entries / mil_assets were revoked from the `authenticated` role,
 * so a client that tried would simply be refused.
 *
 * Every upload therefore runs through a server-minted upload session:
 *
 *   create        -> owner/admin mints a scoped, expiring session + batch
 *   mint_upload   -> server binds one file to one quarantine path and asset id
 *   PUT           -> the browser writes bytes to that path and nothing else
 *   complete_file -> the server re-hashes, places, and proves the final object
 *
 * The status this module reports is whatever the server actually concluded.
 * "pending_reconcile" is a real outcome and is surfaced as such rather than
 * being rounded up to success or down to failure.
 */
import { supabase } from '@/lib/customSupabaseClient';
import { sha256Hex, clientFileKey } from './checksum';
import { resolveMimeType, validateMediaFile } from './formats';
import { saveUploadSession } from './uploadSessionStore';

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const RETRYABLE_RETRY_DELAY_MS = 1500;

/** Terminal per-file outcomes the UI may render. */
export const UPLOAD_FILE_STATUS = Object.freeze({
  HASHING: 'hashing',
  UPLOADING: 'uploading',
  FINALIZING: 'finalizing',
  UPLOADED: 'uploaded',
  DUPLICATE: 'duplicate',
  PENDING_RECONCILE: 'pending_reconcile',
  IN_PROGRESS: 'in_progress',
  SKIPPED: 'skipped',
  FAILED: 'failed',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
});

/**
 * Raw fetch rather than supabase.functions.invoke: the finalization contract is
 * expressed in HTTP status codes (202 pending, 409 conflict, 410 expired) and
 * invoke() collapses every non-2xx into an opaque error.
 */
async function callUploadSession(body) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token || ANON_KEY;

  let res;
  try {
    res = await fetch(`${FUNCTIONS_BASE}/media-intel-upload-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return { status: 0, ok: false, payload: { error: err?.message || 'Network error', code: 'network' } };
  }

  let payload = {};
  try {
    payload = (await res.json()) || {};
  } catch {
    payload = {};
  }
  return { status: res.status, ok: res.ok, payload };
}

function raiseSessionError(result, fallback) {
  const err = new Error(result.payload?.error || fallback);
  err.code = result.payload?.code;
  err.status = result.status;
  return err;
}

/** Owner/admin only — enforced by the edge function, not by this call. */
export async function createUploadSession({ label, sourcePhone, sourcePerson, expiresHours } = {}) {
  const result = await callUploadSession({
    action: 'create',
    label: label || null,
    sourcePhone: sourcePhone || null,
    sourcePerson: sourcePerson || null,
    expiresHours: expiresHours || 12,
  });
  if (!result.ok) throw raiseSessionError(result, 'Could not create an upload session');
  return result.payload;
}

export async function validateUploadSession(token) {
  const result = await callUploadSession({ action: 'validate', token });
  if (!result.ok) throw raiseSessionError(result, 'Upload session is not usable');
  return result.payload;
}

export async function fetchSessionManifest(token) {
  const result = await callUploadSession({ action: 'manifest', token });
  if (!result.ok) throw raiseSessionError(result, 'Could not load the transfer manifest');
  return result.payload;
}

async function putBytes({ minted, file, mime }) {
  if (minted.signedUrl) {
    const res = await fetch(minted.signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': mime, 'x-upsert': 'false' },
      body: file,
    });
    if (!res.ok) throw new Error(`Storage rejected the upload (${res.status})`);
    return;
  }
  if (minted.token) {
    const { error } = await supabase.storage
      .from(minted.bucket)
      .uploadToSignedUrl(minted.path, minted.token, file, { contentType: mime });
    if (error) throw error;
    return;
  }
  throw new Error('No signed upload credentials were returned');
}

/**
 * Translate the finalize HTTP contract into a UI state. Nothing here upgrades an
 * unproven result: only an explicit 200 uploaded/duplicate counts as success.
 */
function interpretCompletion({ status, payload }) {
  if (status === 200) {
    if (payload.status === 'duplicate') {
      return {
        status: UPLOAD_FILE_STATUS.DUPLICATE,
        message: 'Already in the library — kept the existing copy',
        existingAssetId: payload.existingAssetId,
      };
    }
    return { status: UPLOAD_FILE_STATUS.UPLOADED, assetId: payload.assetId };
  }
  if (status === 202) {
    return {
      status: UPLOAD_FILE_STATUS.PENDING_RECONCILE,
      message: payload.error || 'Not confirmed yet — being reconciled. Keep the phone original.',
      grantId: payload.grantId,
    };
  }
  if (status === 409 && payload.code === 'in_progress') {
    return {
      status: UPLOAD_FILE_STATUS.IN_PROGRESS,
      message: 'Already being finalized — check the manifest in a moment.',
    };
  }
  if (status === 410) {
    return {
      status: UPLOAD_FILE_STATUS.EXPIRED,
      message: payload.error || 'This upload link expired. Keep the phone original.',
    };
  }
  if (status === 403) {
    return {
      status: UPLOAD_FILE_STATUS.REVOKED,
      message: payload.error || 'This upload link was revoked.',
    };
  }
  return {
    status: UPLOAD_FILE_STATUS.FAILED,
    message: payload.error || `Upload could not be completed (${status})`,
    code: payload.code,
  };
}

async function completeFile({ token, minted, checksum, byteSize }) {
  const request = {
    action: 'complete_file',
    token,
    grantId: minted.grantId,
    assetId: minted.assetId,
    objectPath: minted.objectPath,
    checksumSha256: checksum,
    byteSize,
  };

  let result = await callUploadSession(request);
  // 503 means "try again", not "it failed". Exactly one retry, then report honestly.
  if (result.status === 503 || result.status === 0) {
    await new Promise((resolve) => setTimeout(resolve, RETRYABLE_RETRY_DELAY_MS));
    result = await callUploadSession(request);
  }
  return interpretCompletion(result);
}

/**
 * Upload files through an existing session token. Per-file failures never stop
 * the batch: one unreadable file in a phone dump must not strand the rest.
 */
export async function uploadFilesToSession({ token, batchId, files, onFileUpdate }) {
  if (!token) throw new Error('An upload session token is required');

  const fileList = Array.from(files || []);
  const totals = {
    uploaded: 0,
    duplicate: 0,
    skipped: 0,
    failed: 0,
    pending_reconcile: 0,
    in_progress: 0,
    expired: 0,
    revoked: 0,
  };

  for (const file of fileList) {
    const key = clientFileKey(file);
    const emit = (patch) => onFileUpdate?.({ clientKey: key, filename: file.name, ...patch });

    try {
      const validation = validateMediaFile(file);
      if (!validation.ok) {
        totals.skipped += 1;
        emit({ status: UPLOAD_FILE_STATUS.SKIPPED, message: validation.reason });
        continue;
      }

      const mime = validation.mime || resolveMimeType(file);
      emit({ status: UPLOAD_FILE_STATUS.HASHING, percent: 0 });
      // Advisory only. The server hashes the stored bytes itself and that digest
      // is the one recorded against the asset.
      const checksum = await sha256Hex(file);

      emit({ status: UPLOAD_FILE_STATUS.UPLOADING, percent: 5 });
      const mintResult = await callUploadSession({
        action: 'mint_upload',
        token,
        filename: file.name,
        contentType: mime,
        byteSize: file.size,
      });
      if (!mintResult.ok) throw raiseSessionError(mintResult, 'Upload grant was not minted');
      const minted = mintResult.payload;
      if (!minted.grantId || !minted.assetId || !minted.objectPath) {
        throw new Error('Upload grant was not minted');
      }

      await putBytes({ minted, file, mime });

      emit({ status: UPLOAD_FILE_STATUS.FINALIZING, percent: 90 });
      const outcome = await completeFile({
        token,
        minted,
        checksum,
        byteSize: file.size,
      });

      totals[outcome.status] = (totals[outcome.status] || 0) + 1;
      emit({ ...outcome, percent: 100 });
    } catch (err) {
      totals.failed += 1;
      emit({ status: UPLOAD_FILE_STATUS.FAILED, message: err?.message || 'Upload failed' });
    }

    if (batchId) {
      await saveUploadSession({ sessionKey: `batch:${batchId}`, batchId, updatedAt: Date.now() });
    }
  }

  return totals;
}

/**
 * Batch + manifest read for signed-in library staff. Read-only: counters are
 * derived server-side from grant states and cannot be written from here.
 */
export async function fetchBatchManifest(batchId) {
  const [{ data: batch }, { data: entries }] = await Promise.all([
    supabase.from('mil_upload_batches').select('*').eq('id', batchId).maybeSingle(),
    supabase
      .from('mil_manifest_entries')
      .select('*')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: true }),
  ]);
  return { batch, entries: entries || [] };
}
