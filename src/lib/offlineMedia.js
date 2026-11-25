const DB_NAME = "market-eye-offline";
const STORE_NAME = "media";
let databasePromise;

function openDatabase() {
  if (!("indexedDB" in window)) return Promise.reject(new Error("Offline media storage is unavailable in this browser."));
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Could not open offline media storage."));
    });
  }
  return databasePromise;
}

async function mediaOperation(mode, key, value) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = mode === "readwrite" && value !== undefined ? store.put(value, key) : mode === "readwrite" ? store.delete(key) : store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Offline media operation failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Offline media transaction failed."));
  });
}

export const saveOfflineMedia = (key, data) => mediaOperation("readwrite", key, data);
export const getOfflineMedia = (key) => mediaOperation("readonly", key);
export const deleteOfflineMedia = (key) => mediaOperation("readwrite", key);
