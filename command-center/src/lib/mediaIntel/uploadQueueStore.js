/**
 * Durable MIL upload queue (IndexedDB).
 * Stores Blobs when available so refresh / short suspension can resume without reselection.
 * Never stores session tokens, bearer secrets, or signed upload signatures.
 */
import { UPLOAD_PHASE, createClientUploadId } from './uploadPhases';

const DB_NAME = 'mil-upload-queue';
const DB_VERSION = 2;
const ITEMS = 'items';
const BATCHES = 'batches';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ITEMS)) {
        const store = db.createObjectStore(ITEMS, { keyPath: 'clientUploadId' });
        store.createIndex('batchId', 'batchId', { unique: false });
        store.createIndex('phase', 'phase', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(BATCHES)) {
        db.createObjectStore(BATCHES, { keyPath: 'batchId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('indexeddb aborted'));
  });
}

/** Strip non-cloneable / secret fields before persist. */
export function sanitizeQueueItemForPersist(item) {
  const {
    // eslint-disable-next-line no-unused-vars
    sessionToken,
    // eslint-disable-next-line no-unused-vars
    signedUrl,
    // eslint-disable-next-line no-unused-vars
    uploadSignature,
    // eslint-disable-next-line no-unused-vars
    tusUploadUrl,
    ...rest
  } = item || {};
  return {
    ...rest,
    clientUploadId: rest.clientUploadId || createClientUploadId(),
    updatedAt: Date.now(),
  };
}

export async function putQueueItem(item) {
  const sanitized = sanitizeQueueItemForPersist(item);
  let blob = null;
  if (sanitized.blob instanceof Blob) {
    try {
      // Clone so Safari is less likely to refuse structured-clone of live File handles.
      blob = sanitized.blob.slice(0, sanitized.blob.size, sanitized.blob.type || undefined);
    } catch {
      blob = null;
    }
  }

  // Always persist metadata first. Blob attach is best-effort — iOS Safari often
  // cannot keep picker Files across refresh, but the queue row must still restore.
  const meta = { ...sanitized, blob: null };
  const db = await openDb();
  {
    const tx = db.transaction(ITEMS, 'readwrite');
    tx.objectStore(ITEMS).put(meta);
    await txDone(tx);
  }

  if (!blob) return { ...sanitized, blob: null };

  try {
    const withBlob = { ...sanitized, blob };
    const tx = db.transaction(ITEMS, 'readwrite');
    tx.objectStore(ITEMS).put(withBlob);
    await txDone(tx);
    return withBlob;
  } catch {
    return { ...sanitized, blob: null };
  }
}

export async function getQueueItem(clientUploadId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ITEMS, 'readonly');
    const req = tx.objectStore(ITEMS).get(clientUploadId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function listQueueItems({ batchId } = {}) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ITEMS, 'readonly');
    const store = tx.objectStore(ITEMS);
    const req = batchId ? store.index('batchId').getAll(batchId) : store.getAll();
    req.onsuccess = () => {
      const rows = req.result || [];
      rows.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteQueueItem(clientUploadId) {
  const db = await openDb();
  const tx = db.transaction(ITEMS, 'readwrite');
  tx.objectStore(ITEMS).delete(clientUploadId);
  await txDone(tx);
}

export async function clearTerminalQueueItems(olderThanMs = 7 * 24 * 60 * 60 * 1000) {
  const items = await listQueueItems();
  const cutoff = Date.now() - olderThanMs;
  await Promise.all(
    items
      .filter((i) =>
        [UPLOAD_PHASE.FINALIZED, UPLOAD_PHASE.ANALYSIS_COMPLETE, UPLOAD_PHASE.CANCELLED].includes(i.phase) &&
        (i.updatedAt || 0) < cutoff,
      )
      .map((i) => deleteQueueItem(i.clientUploadId)),
  );
}

export async function saveBatchBookmark({ batchId, label }) {
  if (!batchId) return;
  const db = await openDb();
  const tx = db.transaction(BATCHES, 'readwrite');
  tx.objectStore(BATCHES).put({ batchId, label: label || null, updatedAt: Date.now() });
  await txDone(tx);
}

export async function listBatchBookmarks() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BATCHES, 'readonly');
    const req = tx.objectStore(BATCHES).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Build a new queue item from a File/Blob. Stores the blob for resume when possible.
 */
export function buildQueueItemFromFile(file, { batchId = null } = {}) {
  const clientUploadId = createClientUploadId();
  return {
    clientUploadId,
    batchId,
    filename: file.name,
    mimeType: file.type || '',
    byteSize: file.size,
    lastModified: file.lastModified || 0,
    checksumSha256: null,
    grantId: null,
    assetId: null,
    objectPath: null,
    bucket: null,
    transferredBytes: 0,
    retryCount: 0,
    phase: UPLOAD_PHASE.SELECTED,
    errorLayer: null,
    errorMessage: null,
    blob: file,
    tusUrl: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/** Match a reselected file to a needs_reselect queue item. */
export function matchReselectFile(item, file) {
  if (!item || !file) return false;
  if (item.byteSize !== file.size) return false;
  // Filename match is preferred, but iOS Photos may alter the export name.
  // lastModified is intentionally ignored — Safari often regenerates it on re-pick.
  if (item.filename && file.name && item.filename !== file.name) {
    const base = (n) => String(n).replace(/\.[^.]+$/, '').toLowerCase();
    if (base(item.filename) !== base(file.name)) return false;
  }
  return true;
}

/** True when a persisted Blob can still be read (Safari often leaves unreadable stubs). */
export async function isReadableBlob(blob) {
  if (!(blob instanceof Blob) || blob.size === 0) return false;
  try {
    const slice = blob.slice(0, Math.min(64, blob.size));
    await slice.arrayBuffer();
    return true;
  } catch {
    return false;
  }
}

/** Mark items that lost their blob after restart. */
export async function markMissingBlobsForReselect() {
  const items = await listQueueItems();
  const active = items.filter((i) =>
    ![
      UPLOAD_PHASE.FINALIZED,
      UPLOAD_PHASE.ANALYSIS_COMPLETE,
      UPLOAD_PHASE.ANALYSIS_FAILED,
      UPLOAD_PHASE.CANCELLED,
      UPLOAD_PHASE.FAILED,
    ].includes(i.phase),
  );
  for (const item of active) {
    const readable = await isReadableBlob(item.blob);
    if (!readable) {
      await putQueueItem({
        ...item,
        phase: UPLOAD_PHASE.NEEDS_RESELECT,
        errorLayer: 'upload_interrupted',
        errorMessage: 'This browser no longer has the local file after refresh. Reselect it to continue.',
        blob: null,
      });
    }
  }
}
