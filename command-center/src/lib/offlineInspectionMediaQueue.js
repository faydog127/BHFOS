import { withStore } from '@/lib/idb';

const nowIso = () => new Date().toISOString();

const toQueueItem = (item) => ({
  ...item,
  // Ensure stable schema
  status: item.status || 'queued', // queued | uploading | failed
  error: item.error || null,
});

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

  async add(item) {
    const row = toQueueItem({
      ...item,
      created_at: item.created_at || nowIso(),
      updated_at: nowIso(),
    });
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

