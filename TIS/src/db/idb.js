const DB_NAME = "tis-storage";
const STORE_NAME = "kv";

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function withStore(mode, action) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = action(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function idbGet(key) {
  return withStore("readonly", (store) => store.get(key));
}

export function idbSet(key, value) {
  return withStore("readwrite", (store) => store.put(value, key));
}

export function idbDel(key) {
  return withStore("readwrite", (store) => store.delete(key));
}

export const PHOTO_PREFIX = "photo:";

export function photoKey(id) {
  return `${PHOTO_PREFIX}${id}`;
}

export function savePhotoBlob(id, blob) {
  return idbSet(photoKey(id), blob);
}

export function getPhotoBlob(id) {
  return idbGet(photoKey(id)).then((value) => {
    if (!value) return value;
    if (typeof value === "string" && value.startsWith("data:")) {
      const [meta, content] = value.split(",");
      if (!meta || !content) return null;
      const match = meta.match(/data:([^;]+);base64/);
      const mime = match ? match[1] : "image/jpeg";
      const binary = atob(content);
      const buffer = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        buffer[i] = binary.charCodeAt(i);
      }
      return new Blob([buffer], { type: mime });
    }
    return value;
  });
}

export function removePhotoBlob(id) {
  return idbDel(photoKey(id));
}
