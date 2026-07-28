/**
 * Media Intelligence upload client — durable queue + signed TUS + finalize.
 *
 * Browser never writes library tables. Flow:
 *   create / validate session
 *   mint_upload (idempotent via clientUploadId)
 *   signed TUS (or PUT fallback) into quarantine
 *   complete_file (server re-hash + place + prove)
 *   poll analysis status (server may auto-trigger analyze after commit)
 */
import { supabase } from '@/lib/customSupabaseClient';
import { sha256Hex, clientFileKey } from './checksum';
import { resolveMimeType, validateMediaFile } from './formats';
import { saveUploadSession } from './uploadSessionStore';
import { queueAiAnalysis } from './api';
import {
  buildQueueItemFromFile,
  listQueueItems,
  markMissingBlobsForReselect,
  matchReselectFile,
  putQueueItem,
  saveBatchBookmark,
} from './uploadQueueStore';
import {
  ERROR_LAYER,
  UPLOAD_PHASE,
  UPLOAD_PHASE_LABELS,
  isActiveUploadPhase,
} from './uploadPhases';
import {
  isAbortError,
  isTransientUploadError,
  uploadViaSignedPut,
  uploadViaSignedTus,
} from './resumableUpload';
import {
  bindWakeLockVisibilityHandler,
  releaseUploadWakeLock,
  requestUploadWakeLock,
} from './wakeLock';
import { buildAnalysisOutcome } from './analysisDisplay';

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const RETRYABLE_RETRY_DELAY_MS = 1500;
const MAX_UPLOAD_ATTEMPTS = 5;
const ANALYSIS_POLL_MS = 2500;
const ANALYSIS_POLL_MAX_MS = 3 * 60 * 1000;
const CONCURRENCY = 2;

/** @deprecated Prefer UPLOAD_PHASE — kept for existing UI/tests. */
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
  QUEUED: 'queued',
  INTERRUPTED: 'interrupted',
  ANALYZING: 'analyzing',
  ANALYSIS_COMPLETE: 'analysis_complete',
  ANALYSIS_FAILED: 'analysis_failed',
  NEEDS_RESELECT: 'needs_reselect',
});

export { UPLOAD_PHASE, UPLOAD_PHASE_LABELS, ERROR_LAYER };

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

export function isRetryableCompletionStatus(status) {
  return status === 503 || status === 0;
}

export function interpretCompletion({ status, payload }) {
  // Keep this helper free of other module bindings so unit tests can extract it.
  if (status === 200) {
    if (payload.status === 'duplicate') {
      return {
        status: UPLOAD_FILE_STATUS.DUPLICATE,
        message: 'Already in the library — kept the existing copy',
        existingAssetId: payload.existingAssetId,
        phase: 'finalized',
      };
    }
    return {
      status: UPLOAD_FILE_STATUS.UPLOADED,
      assetId: payload.assetId,
      phase: 'finalized',
    };
  }
  if (status === 202) {
    return {
      status: UPLOAD_FILE_STATUS.PENDING_RECONCILE,
      message: payload.error || 'Not confirmed yet — being reconciled. Keep the phone original.',
      grantId: payload.grantId,
      phase: 'finalizing',
    };
  }
  if (status === 409 && payload.code === 'in_progress') {
    return {
      status: UPLOAD_FILE_STATUS.IN_PROGRESS,
      message: 'Already being finalized — check the manifest in a moment.',
      phase: 'finalizing',
    };
  }
  if (status === 410) {
    return {
      status: UPLOAD_FILE_STATUS.EXPIRED,
      message: payload.error || 'This upload link expired. Keep the phone original.',
      phase: 'failed',
      errorLayer: 'upload_authorization_failed',
    };
  }
  if (status === 403) {
    return {
      status: UPLOAD_FILE_STATUS.REVOKED,
      message: payload.error || 'This upload link was revoked.',
      phase: 'failed',
      errorLayer: 'upload_authorization_failed',
    };
  }
  return {
    status: UPLOAD_FILE_STATUS.FAILED,
    message: payload.error || `Upload could not be completed (${status})`,
    code: payload.code,
    phase: 'failed',
    errorLayer: 'finalization_failed',
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
    clientUploadId: minted.clientUploadId || null,
  };

  let result = await callUploadSession(request);
  if (isRetryableCompletionStatus(result.status)) {
    await new Promise((resolve) => setTimeout(resolve, RETRYABLE_RETRY_DELAY_MS));
    result = await callUploadSession(request);
  }
  return interpretCompletion(result);
}

async function mintForItem({ token, item, mime }) {
  const result = await callUploadSession({
    action: 'mint_upload',
    token,
    filename: item.filename,
    contentType: mime,
    byteSize: item.byteSize,
    clientUploadId: item.clientUploadId,
  });
  if (!result.ok) throw raiseSessionError(result, 'Upload grant was not minted');
  const minted = result.payload;
  if (!minted.grantId || !minted.assetId || !minted.objectPath) {
    throw new Error('Upload grant was not minted');
  }
  return minted;
}

async function refreshGrant({ token, grantId, clientUploadId }) {
  const result = await callUploadSession({
    action: 'refresh_upload_grant',
    token,
    grantId,
    clientUploadId,
  });
  if (!result.ok) throw raiseSessionError(result, 'Could not refresh upload authorization');
  return result.payload;
}

function phaseToLegacyStatus(phase, outcomeStatus) {
  if (outcomeStatus) return outcomeStatus;
  switch (phase) {
    case UPLOAD_PHASE.PREPARING:
      return UPLOAD_FILE_STATUS.HASHING;
    case UPLOAD_PHASE.UPLOADING:
    case UPLOAD_PHASE.RETRYING:
      return UPLOAD_FILE_STATUS.UPLOADING;
    case UPLOAD_PHASE.FINALIZING:
    case UPLOAD_PHASE.UPLOADED:
      return UPLOAD_FILE_STATUS.FINALIZING;
    case UPLOAD_PHASE.FINALIZED:
    case UPLOAD_PHASE.QUEUED_FOR_ANALYSIS:
      return UPLOAD_FILE_STATUS.UPLOADED;
    case UPLOAD_PHASE.ANALYZING:
      return UPLOAD_FILE_STATUS.ANALYZING;
    case UPLOAD_PHASE.ANALYSIS_COMPLETE:
      return UPLOAD_FILE_STATUS.ANALYSIS_COMPLETE;
    case UPLOAD_PHASE.ANALYSIS_FAILED:
      return UPLOAD_FILE_STATUS.ANALYSIS_FAILED;
    case UPLOAD_PHASE.INTERRUPTED:
      return UPLOAD_FILE_STATUS.INTERRUPTED;
    case UPLOAD_PHASE.NEEDS_RESELECT:
      return UPLOAD_FILE_STATUS.NEEDS_RESELECT;
    case UPLOAD_PHASE.QUEUED:
    case UPLOAD_PHASE.SELECTED:
      return UPLOAD_FILE_STATUS.QUEUED;
    default:
      return UPLOAD_FILE_STATUS.FAILED;
  }
}

async function persistAndEmit(item, patch, onFileUpdate) {
  const next = { ...item, ...patch, updatedAt: Date.now() };
  await putQueueItem(next);
  const percent =
    next.byteSize > 0 && typeof next.transferredBytes === 'number'
      ? Math.min(99, Math.round((next.transferredBytes / next.byteSize) * 100))
      : next.phase === UPLOAD_PHASE.FINALIZING
        ? 90
        : next.phase === UPLOAD_PHASE.FINALIZED || next.phase === UPLOAD_PHASE.ANALYSIS_COMPLETE
          ? 100
          : undefined;
  onFileUpdate?.({
    clientKey: next.clientUploadId,
    clientUploadId: next.clientUploadId,
    filename: next.filename,
    status: phaseToLegacyStatus(next.phase, patch.legacyStatus),
    phase: next.phase,
    percent,
    transferredBytes: next.transferredBytes,
    byteSize: next.byteSize,
    message: next.errorMessage || UPLOAD_PHASE_LABELS[next.phase] || next.phase,
    assetId: next.assetId,
    errorLayer: next.errorLayer,
    analysisOutcome: next.analysisOutcome || null,
  });
  return next;
}

async function transferBytes({ item, minted, mime, onFileUpdate, signal }) {
  let current = item;
  const onProgress = async (loaded, total) => {
    current = await persistAndEmit(
      current,
      {
        phase: current.retryCount ? UPLOAD_PHASE.RETRYING : UPLOAD_PHASE.UPLOADING,
        transferredBytes: loaded,
        byteSize: total || current.byteSize,
        errorMessage: null,
        errorLayer: null,
      },
      onFileUpdate,
    );
  };

  try {
    if (minted.token) {
      await uploadViaSignedTus({
        file: current.blob,
        bucket: minted.bucket || 'media-intel-originals',
        objectPath: minted.objectPath,
        contentType: mime,
        signatureToken: minted.token,
        fingerprint: `mil:${current.clientUploadId}:${minted.objectPath}`,
        onProgress,
        signal,
      });
      return current;
    }
    await uploadViaSignedPut({
      signedUrl: minted.signedUrl,
      file: current.blob,
      contentType: mime,
      onProgress,
      signal,
    });
    return current;
  } catch (err) {
    if (!isTransientUploadError(err) || /signature|forbidden|401|403/.test(String(err?.message || ''))) {
      // Try one grant refresh then TUS again for auth expiry.
      if (minted.grantId && /signature|401|403|expired|forbidden/i.test(String(err?.message || ''))) {
        throw Object.assign(err, { code: 'needs_refresh' });
      }
    }
    throw err;
  }
}

async function processQueueItem({ token, item, onFileUpdate, signal }) {
  let current = item;
  if (!current.blob || !(current.blob instanceof Blob)) {
    return persistAndEmit(
      current,
      {
        phase: UPLOAD_PHASE.NEEDS_RESELECT,
        errorLayer: ERROR_LAYER.UPLOAD_INTERRUPTED,
        errorMessage: 'Reselect this file to continue the upload.',
        legacyStatus: UPLOAD_FILE_STATUS.NEEDS_RESELECT,
      },
      onFileUpdate,
    );
  }

  const validation = validateMediaFile(
    current.blob instanceof File
      ? current.blob
      : new File([current.blob], current.filename, { type: current.mimeType }),
  );
  if (!validation.ok) {
    return persistAndEmit(
      current,
      {
        phase: UPLOAD_PHASE.FAILED,
        errorLayer: ERROR_LAYER.UNSUPPORTED,
        errorMessage: validation.reason,
        legacyStatus: UPLOAD_FILE_STATUS.SKIPPED,
      },
      onFileUpdate,
    );
  }

  const mime = validation.mime || resolveMimeType({ name: current.filename, type: current.mimeType }) || current.mimeType;

  current = await persistAndEmit(
    current,
    { phase: UPLOAD_PHASE.PREPARING, errorMessage: null, errorLayer: null },
    onFileUpdate,
  );

  if (!current.checksumSha256) {
    const checksum = await sha256Hex(current.blob);
    current = await persistAndEmit(current, { checksumSha256: checksum }, onFileUpdate);
  }

  current = await persistAndEmit(
    current,
    { phase: UPLOAD_PHASE.AWAITING_AUTHORIZATION },
    onFileUpdate,
  );

  let minted;
  try {
    if (current.grantId && current.objectPath) {
      try {
        minted = await refreshGrant({
          token,
          grantId: current.grantId,
          clientUploadId: current.clientUploadId,
        });
      } catch {
        minted = await mintForItem({ token, item: current, mime });
      }
    } else {
      minted = await mintForItem({ token, item: current, mime });
    }
  } catch (err) {
    const transient = isTransientUploadError(err);
    return persistAndEmit(
      current,
      {
        phase: transient ? UPLOAD_PHASE.INTERRUPTED : UPLOAD_PHASE.FAILED,
        errorLayer: transient ? ERROR_LAYER.NETWORK : ERROR_LAYER.UPLOAD_AUTHORIZATION,
        errorMessage: err?.message || (transient ? 'Network interrupted during authorization' : 'Upload authorization failed'),
        legacyStatus: transient ? UPLOAD_FILE_STATUS.INTERRUPTED : UPLOAD_FILE_STATUS.FAILED,
      },
      onFileUpdate,
    );
  }

  current = await persistAndEmit(
    current,
    {
      grantId: minted.grantId,
      assetId: minted.assetId,
      objectPath: minted.objectPath,
      bucket: minted.bucket,
      batchId: minted.batchId || current.batchId,
      phase: UPLOAD_PHASE.UPLOADING,
      transferredBytes: current.transferredBytes || 0,
    },
    onFileUpdate,
  );

  let attempts = 0;
  while (attempts < MAX_UPLOAD_ATTEMPTS) {
    attempts += 1;
    try {
      current = await persistAndEmit(
        current,
        {
          phase: attempts > 1 ? UPLOAD_PHASE.RETRYING : UPLOAD_PHASE.UPLOADING,
          retryCount: attempts - 1,
        },
        onFileUpdate,
      );
      await transferBytes({ item: current, minted, mime, onFileUpdate, signal });
      break;
    } catch (err) {
      if (isAbortError(err)) {
        return persistAndEmit(
          current,
          {
            phase: UPLOAD_PHASE.CANCELLED,
            errorMessage: 'Cancelled',
            legacyStatus: UPLOAD_FILE_STATUS.FAILED,
          },
          onFileUpdate,
        );
      }
      if (err?.code === 'needs_refresh' || /signature|expired|403|401/i.test(String(err?.message || ''))) {
        try {
          minted = await refreshGrant({
            token,
            grantId: current.grantId,
            clientUploadId: current.clientUploadId,
          });
          continue;
        } catch (refreshErr) {
          return persistAndEmit(
            current,
            {
              phase: UPLOAD_PHASE.FAILED,
              errorLayer: ERROR_LAYER.UPLOAD_AUTHORIZATION,
              errorMessage: refreshErr?.message || err.message,
              legacyStatus: UPLOAD_FILE_STATUS.FAILED,
            },
            onFileUpdate,
          );
        }
      }
      if (!isTransientUploadError(err) || attempts >= MAX_UPLOAD_ATTEMPTS) {
        return persistAndEmit(
          current,
          {
            phase: UPLOAD_PHASE.INTERRUPTED,
            errorLayer: ERROR_LAYER.UPLOAD_INTERRUPTED,
            errorMessage: err?.message || 'Upload interrupted',
            retryCount: attempts,
            legacyStatus: UPLOAD_FILE_STATUS.INTERRUPTED,
          },
          onFileUpdate,
        );
      }
      await new Promise((r) => setTimeout(r, Math.min(20000, 1000 * 2 ** (attempts - 1))));
    }
  }

  current = await persistAndEmit(
    current,
    {
      phase: UPLOAD_PHASE.FINALIZING,
      transferredBytes: current.byteSize,
      legacyStatus: UPLOAD_FILE_STATUS.FINALIZING,
    },
    onFileUpdate,
  );

  try {
    const outcome = await completeFile({
      token,
      minted: { ...minted, clientUploadId: current.clientUploadId },
      checksum: current.checksumSha256,
      byteSize: current.byteSize,
    });

    if (outcome.status === UPLOAD_FILE_STATUS.PENDING_RECONCILE || outcome.status === UPLOAD_FILE_STATUS.IN_PROGRESS) {
      return persistAndEmit(
        current,
        {
          phase: UPLOAD_PHASE.FINALIZING,
          errorMessage: outcome.message,
          legacyStatus: outcome.status,
        },
        onFileUpdate,
      );
    }

    if (outcome.status === UPLOAD_FILE_STATUS.FAILED || outcome.status === UPLOAD_FILE_STATUS.EXPIRED || outcome.status === UPLOAD_FILE_STATUS.REVOKED) {
      return persistAndEmit(
        current,
        {
          phase: UPLOAD_PHASE.FAILED,
          errorLayer: outcome.errorLayer || ERROR_LAYER.FINALIZATION,
          errorMessage: outcome.message,
          legacyStatus: outcome.status,
        },
        onFileUpdate,
      );
    }

    const assetId = outcome.assetId || outcome.existingAssetId || current.assetId;
    current = await persistAndEmit(
      current,
      {
        phase: UPLOAD_PHASE.QUEUED_FOR_ANALYSIS,
        assetId,
        errorMessage:
          outcome.status === UPLOAD_FILE_STATUS.DUPLICATE
            ? outcome.message
            : 'In the library — awaiting analysis',
        legacyStatus: outcome.status,
        blob: null,
      },
      onFileUpdate,
    );

    // Server may auto-trigger analyze after commit; also invoke from the
    // authenticated client so a short-lived server trigger cannot leave jobs queued.
    try {
      await queueAiAnalysis(assetId);
    } catch (analyzeErr) {
      // Upload already finalized — keep queue honest and let poll/retry surface AI failure.
      current = await persistAndEmit(
        current,
        {
          phase: UPLOAD_PHASE.QUEUED_FOR_ANALYSIS,
          errorLayer: ERROR_LAYER.ANALYSIS,
          errorMessage: analyzeErr?.message || 'Analysis request failed — retry from Review',
          legacyStatus: UPLOAD_FILE_STATUS.UPLOADED,
        },
        onFileUpdate,
      );
    }

    const analyzed = await pollAnalysisUntilSettled(assetId, {
      onUpdate: async (analysisPatch) => {
        current = await persistAndEmit(current, analysisPatch, onFileUpdate);
      },
    });
    return analyzed || current;
  } catch (err) {
    const transient = isTransientUploadError(err);
    return persistAndEmit(
      current,
      {
        phase: transient ? UPLOAD_PHASE.INTERRUPTED : UPLOAD_PHASE.FAILED,
        errorLayer: transient ? ERROR_LAYER.NETWORK : ERROR_LAYER.FINALIZATION,
        errorMessage: err?.message || (transient ? 'Network interrupted during finalization' : 'Finalization failed'),
        legacyStatus: transient ? UPLOAD_FILE_STATUS.INTERRUPTED : UPLOAD_FILE_STATUS.FAILED,
      },
      onFileUpdate,
    );
  }
}

export async function pollAnalysisUntilSettled(assetId, { onUpdate, timeoutMs = ANALYSIS_POLL_MAX_MS } = {}) {
  if (!assetId) return null;
  const started = Date.now();
  let delay = ANALYSIS_POLL_MS;

  while (Date.now() - started < timeoutMs) {
    const { data: asset } = await supabase
      .from('mil_assets')
      .select('id, processing_status, human_review_status, media_kind, original_filename')
      .eq('id', assetId)
      .maybeSingle();
    const { data: analyses } = await supabase
      .from('mil_ai_analyses')
      .select('*')
      .eq('asset_id', assetId)
      .order('analyzed_at', { ascending: false })
      .limit(1);
    const analysis = analyses?.[0] || null;
    const outcome = buildAnalysisOutcome(asset, analysis);
    const processing = asset?.processing_status;

    if (outcome.uiStatus === 'analyzing' || processing === 'analyzing') {
      await onUpdate?.({
        phase: UPLOAD_PHASE.ANALYZING,
        analysisOutcome: outcome,
        legacyStatus: UPLOAD_FILE_STATUS.ANALYZING,
        errorMessage: 'Analyzing',
      });
    } else if (outcome.uiStatus === 'complete') {
      await onUpdate?.({
        phase: UPLOAD_PHASE.ANALYSIS_COMPLETE,
        analysisOutcome: outcome,
        legacyStatus: UPLOAD_FILE_STATUS.ANALYSIS_COMPLETE,
        errorMessage: 'Ready for review',
      });
      return { assetId, analysisOutcome: outcome, phase: UPLOAD_PHASE.ANALYSIS_COMPLETE };
    } else if (outcome.uiStatus === 'failed') {
      await onUpdate?.({
        phase: UPLOAD_PHASE.ANALYSIS_FAILED,
        analysisOutcome: outcome,
        errorLayer: ERROR_LAYER.ANALYSIS,
        legacyStatus: UPLOAD_FILE_STATUS.ANALYSIS_FAILED,
        errorMessage: outcome.errorMessage || 'Analysis failed',
      });
      return { assetId, analysisOutcome: outcome, phase: UPLOAD_PHASE.ANALYSIS_FAILED };
    } else {
      await onUpdate?.({
        phase: UPLOAD_PHASE.QUEUED_FOR_ANALYSIS,
        analysisOutcome: outcome,
        legacyStatus: UPLOAD_FILE_STATUS.UPLOADED,
        errorMessage: 'Awaiting analysis',
      });
    }

    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(10000, Math.round(delay * 1.25));
  }

  await onUpdate?.({
    phase: UPLOAD_PHASE.QUEUED_FOR_ANALYSIS,
    errorMessage: 'Analysis is still pending — open Review Queue shortly.',
    legacyStatus: UPLOAD_FILE_STATUS.UPLOADED,
  });
  return null;
}

async function runPool(items, worker, concurrency) {
  const queue = [...items];
  const results = [];
  const runners = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      results.push(await worker(item));
    }
  });
  await Promise.all(runners);
  return results;
}

/**
 * Enqueue files into IndexedDB and process with bounded concurrency.
 */
export async function uploadFilesToSession({ token, batchId, files, onFileUpdate }) {
  if (!token) throw new Error('An upload session token is required');

  const unbindWake = bindWakeLockVisibilityHandler();
  await requestUploadWakeLock();

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
    interrupted: 0,
    analysis_complete: 0,
    analysis_failed: 0,
  };

  try {
    const items = [];
    for (const file of fileList) {
      const item = buildQueueItemFromFile(file, { batchId });
      item.phase = UPLOAD_PHASE.QUEUED;
      await putQueueItem(item);
      onFileUpdate?.({
        clientKey: item.clientUploadId,
        clientUploadId: item.clientUploadId,
        filename: item.filename,
        status: UPLOAD_FILE_STATUS.QUEUED,
        phase: UPLOAD_PHASE.QUEUED,
        message: 'Queued',
        byteSize: item.byteSize,
      });
      items.push(item);
    }

    if (batchId) {
      await saveBatchBookmark({ batchId });
      await saveUploadSession({ sessionKey: `batch:${batchId}`, batchId, updatedAt: Date.now() });
    }

    await runPool(
      items,
      async (item) => {
        const result = await processQueueItem({ token, item, onFileUpdate });
        const status = phaseToLegacyStatus(result.phase);
        if (status === UPLOAD_FILE_STATUS.DUPLICATE) totals.duplicate += 1;
        else if (status === UPLOAD_FILE_STATUS.UPLOADED || result.phase === UPLOAD_PHASE.QUEUED_FOR_ANALYSIS || result.phase === UPLOAD_PHASE.FINALIZED) {
          totals.uploaded += 1;
        } else if (result.phase === UPLOAD_PHASE.ANALYSIS_COMPLETE) {
          totals.uploaded += 1;
          totals.analysis_complete += 1;
        } else if (result.phase === UPLOAD_PHASE.ANALYSIS_FAILED) {
          totals.uploaded += 1;
          totals.analysis_failed += 1;
        } else if (result.phase === UPLOAD_PHASE.INTERRUPTED || result.phase === UPLOAD_PHASE.NEEDS_RESELECT) {
          totals.interrupted += 1;
        } else if (status === UPLOAD_FILE_STATUS.SKIPPED) totals.skipped += 1;
        else if (status === UPLOAD_FILE_STATUS.PENDING_RECONCILE) totals.pending_reconcile += 1;
        else totals.failed += 1;
        return result;
      },
      CONCURRENCY,
    );

    return totals;
  } finally {
    await releaseUploadWakeLock();
    unbindWake();
  }
}

/** Restore durable queue UI state and optionally resume interrupted items. */
export async function restoreUploadQueue({ token, onFileUpdate, autoResume = true } = {}) {
  await markMissingBlobsForReselect();
  const items = await listQueueItems();
  for (const item of items) {
    onFileUpdate?.({
      clientKey: item.clientUploadId,
      clientUploadId: item.clientUploadId,
      filename: item.filename,
      status: phaseToLegacyStatus(item.phase),
      phase: item.phase,
      percent:
        item.byteSize > 0 ? Math.min(99, Math.round(((item.transferredBytes || 0) / item.byteSize) * 100)) : undefined,
      transferredBytes: item.transferredBytes,
      byteSize: item.byteSize,
      message: item.errorMessage || UPLOAD_PHASE_LABELS[item.phase],
      assetId: item.assetId,
      errorLayer: item.errorLayer,
      analysisOutcome: item.analysisOutcome || null,
    });
  }

  if (!autoResume || !token) return items;

  const resumable = items.filter((i) => {
    if (!(i.blob instanceof Blob)) return false;
    if (
      [
        UPLOAD_PHASE.INTERRUPTED,
        UPLOAD_PHASE.QUEUED,
        UPLOAD_PHASE.UPLOADING,
        UPLOAD_PHASE.RETRYING,
        UPLOAD_PHASE.FINALIZING,
        UPLOAD_PHASE.AWAITING_AUTHORIZATION,
        UPLOAD_PHASE.PREPARING,
      ].includes(i.phase)
    ) {
      return true;
    }
    return i.phase === UPLOAD_PHASE.FAILED && i.errorLayer === ERROR_LAYER.NETWORK;
  });
  if (!resumable.length) return items;

  await requestUploadWakeLock();
  try {
    await runPool(
      resumable,
      (item) => processQueueItem({ token, item, onFileUpdate }),
      CONCURRENCY,
    );
  } finally {
    await releaseUploadWakeLock();
  }
  return listQueueItems();
}

export async function retryQueueItem({ token, clientUploadId, onFileUpdate }) {
  const items = await listQueueItems();
  const item = items.find((i) => i.clientUploadId === clientUploadId);
  if (!item) throw new Error('Queue item not found');
  if (!item.blob) throw new Error('Reselect this file before retrying');
  return processQueueItem({ token, item: { ...item, phase: UPLOAD_PHASE.QUEUED, retryCount: (item.retryCount || 0) + 1 }, onFileUpdate });
}

export async function attachReselectedFile({ clientUploadId, file, token, onFileUpdate, autoStart = true }) {
  const items = await listQueueItems();
  const item = items.find((i) => i.clientUploadId === clientUploadId);
  if (!item) throw new Error('Queue item not found');
  if (!matchReselectFile(item, file) && item.checksumSha256) {
    // Allow size+name match failure only when user explicitly picks — still accept if name/size match loosely
  }
  if (item.byteSize && file.size !== item.byteSize) {
    throw new Error('Selected file size does not match the interrupted upload. Pick the original file.');
  }
  const next = {
    ...item,
    blob: file,
    filename: file.name || item.filename,
    mimeType: file.type || item.mimeType,
    lastModified: file.lastModified || item.lastModified,
    phase: UPLOAD_PHASE.QUEUED,
    errorMessage: null,
    errorLayer: null,
  };
  await putQueueItem(next);
  onFileUpdate?.({
    clientKey: next.clientUploadId,
    clientUploadId: next.clientUploadId,
    filename: next.filename,
    status: UPLOAD_FILE_STATUS.QUEUED,
    phase: UPLOAD_PHASE.QUEUED,
    message: 'Queued after reselection',
    byteSize: next.byteSize,
  });
  if (autoStart && token) {
    return processQueueItem({ token, item: next, onFileUpdate });
  }
  return next;
}

export function bindUploadExitWarning(isDirtyFn) {
  if (typeof window === 'undefined') return () => {};
  const handler = (e) => {
    if (!isDirtyFn?.()) return;
    e.preventDefault();
    e.returnValue = '';
  };
  window.addEventListener('beforeunload', handler);
  return () => window.removeEventListener('beforeunload', handler);
}

/**
 * When the browser comes back online, resume interrupted (and network-failed) queue items.
 */
export function bindOnlineUploadResume({ getToken, onFileUpdate }) {
  if (typeof window === 'undefined') return () => {};
  let running = false;
  const onOnline = async () => {
    if (running) return;
    running = true;
    try {
      const token = typeof getToken === 'function' ? await getToken() : getToken;
      if (!token) return;
      await restoreUploadQueue({ token, onFileUpdate, autoResume: true });
    } catch {
      /* leave items interrupted for manual retry */
    } finally {
      running = false;
    }
  };
  window.addEventListener('online', onOnline);
  return () => window.removeEventListener('online', onOnline);
}

export function isOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}

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

export { clientFileKey, isActiveUploadPhase };
