import { withStore } from '@/lib/idb';

export const DEFAULT_OFFLINE_CACHE_MB = 250;
const BYTES_PER_MB = 1024 * 1024;

const nowIso = () => new Date().toISOString();

const toQueueItem = (item) => ({
  ...item,
  status: item.status || 'queued', // queued | uploading | failed | uploaded
  error: item.error || null,
  byte_size: Number(item.byte_size) || (item.blob?.size ? Number(item.blob.size) : 0) || 0,
});

const estimateBytes = (row) => {
  const explicit = Number(row?.byte_size);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  if (row?.blob?.size) return Number(row.blob.size) || 0;
  return 0;
};

export const mediaQueue = {
  async list({ tenantId, inspectionId }) {
    const key = [tenantId, inspectionId];
    const rows = await withStore('mediaQueue', 'readonly', (store) => {
      const idx = store.index('byInspection');
      return new Promise((resolve, reject) => {
        const req = idx.getAll(key);
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    });
    return (rows || []).map(toQueueItem).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  },

  async listAllForTenant(tenantId) {
    const rows = await withStore('mediaQueue', 'readonly', (store) => {
      return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    });
    return (rows || [])
      .map(toQueueItem)
      .filter((row) => row.tenant_id === tenantId)
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  },

  async totalBytesForTenant(tenantId) {
    const rows = await this.listAllForTenant(tenantId);
    return rows.reduce((sum, row) => sum + estimateBytes(row), 0);
  },

  /**
   * Enforce PD-S8-02 cache budget. Evicts oldest uploaded/failed rows first, then oldest queued.
   * Returns { ok, usedBytes, limitBytes, evicted }.
   */
  async enforceCacheBudget(tenantId, limitMb = DEFAULT_OFFLINE_CACHE_MB) {
    const limitBytes = Math.max(1, Number(limitMb) || DEFAULT_OFFLINE_CACHE_MB) * BYTES_PER_MB;
    let rows = await this.listAllForTenant(tenantId);
    let used = rows.reduce((sum, row) => sum + estimateBytes(row), 0);
    const evicted = [];

    const evictionOrder = [
      ...rows.filter((r) => r.status === 'uploaded' || r.status === 'failed'),
      ...rows.filter((r) => r.status === 'queued' || r.status === 'uploading'),
    ];

    for (const row of evictionOrder) {
      if (used <= limitBytes) break;
      // Never drop an in-flight upload for the active sync mid-flight unless still over after soft eviction.
      if (row.status === 'uploading') continue;
      await this.remove(row.id);
      evicted.push(row.id);
      used -= estimateBytes(row);
    }

    // Hard fail-closed if still over (only uploading blobs remain).
    if (used > limitBytes) {
      return { ok: false, usedBytes: used, limitBytes, evicted, code: 'ML_P1_S8_OFFLINE_CACHE_FULL' };
    }
    return { ok: true, usedBytes: used, limitBytes, evicted };
  },

  async add(item, { cacheMb = DEFAULT_OFFLINE_CACHE_MB } = {}) {
    const row = toQueueItem({
      ...item,
      byte_size: estimateBytes(item),
      created_at: item.created_at || nowIso(),
      updated_at: nowIso(),
    });

    if (row.tenant_id) {
      const budget = await this.enforceCacheBudget(row.tenant_id, cacheMb);
      const projected = budget.usedBytes + estimateBytes(row);
      if (projected > budget.limitBytes) {
        const err = new Error('Offline photo cache is full. Sync or free space, then retry.');
        err.code = 'ML_P1_S8_OFFLINE_CACHE_FULL';
        err.budget = budget;
        throw err;
      }
    }

    await withStore('mediaQueue', 'readwrite', (store) => store.put(row));
    return row;
  },

  async patch(id, patch) {
    const existing = await withStore('mediaQueue', 'readonly', (store) => {
      return new Promise((resolve, reject) => {
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    });

    if (!existing) return null;

    const next = toQueueItem({
      ...existing,
      ...patch,
      updated_at: nowIso(),
    });

    await withStore('mediaQueue', 'readwrite', (store) => store.put(next));
    return next;
  },

  async remove(id) {
    await withStore('mediaQueue', 'readwrite', (store) => store.delete(id));
  },
};
