const DB_NAME = 'bhfos-tech';
const DB_VERSION = 1;

let dbPromise = null;

export const openDb = () => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('mediaQueue')) {
        const store = db.createObjectStore('mediaQueue', { keyPath: 'id' });
        store.createIndex('byInspection', ['tenant_id', 'inspection_id'], { unique: false });
        store.createIndex('byStatus', ['tenant_id', 'inspection_id', 'status'], { unique: false });
        store.createIndex('byCreated', ['tenant_id', 'inspection_id', 'created_at'], { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return dbPromise;
};

export const withStore = async (storeName, mode, fn) => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const result = fn(store);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
};

