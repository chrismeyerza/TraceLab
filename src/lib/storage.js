// Persistent shot storage via IndexedDB. Holds tens of thousands of shots
// comfortably. Data lives in the user's browser only — no server, no sync.

const DB_NAME = 'foresight-analytics';
const DB_VERSION = 1;
const STORE_SHOTS = 'shots';
const STORE_META = 'meta';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_SHOTS)) {
        const store = db.createObjectStore(STORE_SHOTS, { keyPath: 'id', autoIncrement: true });
        store.createIndex('sessionId', 'sessionId', { unique: false });
        store.createIndex('club', 'club', { unique: false });
        // Unique dedup index lets us silently drop duplicate re-imports.
        store.createIndex('dedup', 'dedup', { unique: true });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function getAllShots() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SHOTS, 'readonly');
    const req = tx.objectStore(STORE_SHOTS).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Insert shots, skipping those that violate the unique dedup index.
 * Returns { added, skipped }.
 */
export async function addShots(shots) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SHOTS, 'readwrite');
    const store = tx.objectStore(STORE_SHOTS);
    let added = 0;
    let skipped = 0;
    let pending = shots.length;
    if (pending === 0) {
      resolve({ added, skipped });
      return;
    }
    shots.forEach((shot) => {
      const req = store.add(shot);
      req.onsuccess = () => {
        added++;
        if (--pending === 0) resolve({ added, skipped });
      };
      req.onerror = (e) => {
        // Dedup hit — perfectly normal when re-importing the same file.
        skipped++;
        e.preventDefault();
        if (--pending === 0) resolve({ added, skipped });
      };
    });
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllShots() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SHOTS, 'readwrite');
    tx.objectStore(STORE_SHOTS).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteSession(sessionId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SHOTS, 'readwrite');
    const store = tx.objectStore(STORE_SHOTS);
    const idx = store.index('sessionId');
    const req = idx.openCursor(IDBKeyRange.only(sessionId));
    req.onsuccess = (e) => {
      const cur = e.target.result;
      if (cur) {
        cur.delete();
        cur.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
