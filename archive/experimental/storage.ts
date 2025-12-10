/**
 * IndexedDB Storage Layer
 * Proper local-first database with async operations
 * Replaces naive localStorage implementation
 */

const DB_NAME = "dragonshoard";
const DB_VERSION = 3;

// === Store Names ===
export const STORES = {
  GAMES: "games",
  COLLECTION: "collection",
  EVENTS: "events",
  PREFERENCES: "preferences",
  CACHE: "cache",
} as const;

type StoreName = (typeof STORES)[keyof typeof STORES];

// === Database Instance ===

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Games store - indexed by key
      if (!db.objectStoreNames.contains(STORES.GAMES)) {
        const gamesStore = db.createObjectStore(STORES.GAMES, { keyPath: "key" });
        gamesStore.createIndex("platform", "platform", { unique: false });
        gamesStore.createIndex("genre", "genre", { unique: false });
        gamesStore.createIndex("year", "release_year", { unique: false });
        gamesStore.createIndex("rating", "rating", { unique: false });
        gamesStore.createIndex("name", "game_name", { unique: false });
      }

      // Collection store
      if (!db.objectStoreNames.contains(STORES.COLLECTION)) {
        const collectionStore = db.createObjectStore(STORES.COLLECTION, {
          keyPath: "gameKey",
        });
        collectionStore.createIndex("status", "status", { unique: false });
        collectionStore.createIndex("addedAt", "addedAt", { unique: false });
        collectionStore.createIndex("updatedAt", "updatedAt", { unique: false });
      }

      // Events store for event sourcing
      if (!db.objectStoreNames.contains(STORES.EVENTS)) {
        const eventsStore = db.createObjectStore(STORES.EVENTS, { keyPath: "id" });
        eventsStore.createIndex("timestamp", "timestamp", { unique: false });
        eventsStore.createIndex("type", "type", { unique: false });
        eventsStore.createIndex("version", "version", { unique: true });
      }

      // Preferences store
      if (!db.objectStoreNames.contains(STORES.PREFERENCES)) {
        db.createObjectStore(STORES.PREFERENCES, { keyPath: "key" });
      }

      // Cache store
      if (!db.objectStoreNames.contains(STORES.CACHE)) {
        const cacheStore = db.createObjectStore(STORES.CACHE, { keyPath: "key" });
        cacheStore.createIndex("expiresAt", "expiresAt", { unique: false });
      }
    };
  });

  return dbPromise;
}

// === Generic Operations ===

export async function put<T>(store: StoreName, data: T): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const objectStore = tx.objectStore(store);
    const request = objectStore.put(data);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function get<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const objectStore = tx.objectStore(store);
    const request = objectStore.get(key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function getAll<T>(store: StoreName): Promise<T[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const objectStore = tx.objectStore(store);
    const request = objectStore.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function remove(store: StoreName, key: IDBValidKey): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const objectStore = tx.objectStore(store);
    const request = objectStore.delete(key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function clear(store: StoreName): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const objectStore = tx.objectStore(store);
    const request = objectStore.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function count(store: StoreName): Promise<number> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const objectStore = tx.objectStore(store);
    const request = objectStore.count();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// === Batch Operations ===

export async function putMany<T>(store: StoreName, items: T[]): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const objectStore = tx.objectStore(store);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);

    for (const item of items) {
      objectStore.put(item);
    }
  });
}

export async function getByIndex<T>(
  store: StoreName,
  indexName: string,
  value: IDBValidKey
): Promise<T[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const objectStore = tx.objectStore(store);
    const index = objectStore.index(indexName);
    const request = index.getAll(value);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function getByRange<T>(
  store: StoreName,
  indexName: string,
  lower: IDBValidKey,
  upper: IDBValidKey
): Promise<T[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const objectStore = tx.objectStore(store);
    const index = objectStore.index(indexName);
    const range = IDBKeyRange.bound(lower, upper);
    const request = index.getAll(range);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// === Cursor Operations for Large Datasets ===

export async function iterate<T>(
  store: StoreName,
  callback: (item: T, cursor: IDBCursorWithValue) => boolean | void
): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const objectStore = tx.objectStore(store);
    const request = objectStore.openCursor();

    request.onerror = () => reject(request.error);
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        const shouldContinue = callback(cursor.value, cursor);
        if (shouldContinue !== false) {
          cursor.continue();
        } else {
          resolve();
        }
      } else {
        resolve();
      }
    };
  });
}

// === Cache Helpers ===

interface CacheEntry<T> {
  key: string;
  value: T;
  expiresAt: number;
}

export async function setCache<T>(
  key: string,
  value: T,
  ttlMs: number = 24 * 60 * 60 * 1000
): Promise<void> {
  const entry: CacheEntry<T> = {
    key,
    value,
    expiresAt: Date.now() + ttlMs,
  };
  await put(STORES.CACHE, entry);
}

export async function getCache<T>(key: string): Promise<T | undefined> {
  const entry = await get<CacheEntry<T>>(STORES.CACHE, key);
  if (!entry) return undefined;

  if (entry.expiresAt < Date.now()) {
    await remove(STORES.CACHE, key);
    return undefined;
  }

  return entry.value;
}

export async function clearExpiredCache(): Promise<void> {
  const db = await getDB();
  const now = Date.now();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.CACHE, "readwrite");
    const objectStore = tx.objectStore(STORES.CACHE);
    const index = objectStore.index("expiresAt");
    const range = IDBKeyRange.upperBound(now);
    const request = index.openCursor(range);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
  });
}

// === Event Storage ===

export async function appendEvent<T>(event: T): Promise<void> {
  await put(STORES.EVENTS, event);
}

export async function getEventsAfter<T>(version: number): Promise<T[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.EVENTS, "readonly");
    const objectStore = tx.objectStore(STORES.EVENTS);
    const index = objectStore.index("version");
    const range = IDBKeyRange.lowerBound(version, true);
    const request = index.getAll(range);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function getEventCount(): Promise<number> {
  return count(STORES.EVENTS);
}

export async function trimEvents(keepCount: number): Promise<void> {
  const totalCount = await count(STORES.EVENTS);
  if (totalCount <= keepCount) return;

  const db = await getDB();
  const deleteCount = totalCount - keepCount;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.EVENTS, "readwrite");
    const objectStore = tx.objectStore(STORES.EVENTS);
    const index = objectStore.index("version");
    const request = index.openCursor();
    let deleted = 0;

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor && deleted < deleteCount) {
        cursor.delete();
        deleted++;
        cursor.continue();
      }
    };
  });
}

// === Preferences ===

export async function setPreference<T>(key: string, value: T): Promise<void> {
  await put(STORES.PREFERENCES, { key, value });
}

export async function getPreference<T>(key: string, defaultValue: T): Promise<T> {
  const entry = await get<{ key: string; value: T }>(STORES.PREFERENCES, key);
  return entry?.value ?? defaultValue;
}

// === Database Management ===

export async function exportDatabase(): Promise<Record<string, unknown[]>> {
  const result: Record<string, unknown[]> = {};

  for (const storeName of Object.values(STORES)) {
    result[storeName] = await getAll(storeName);
  }

  return result;
}

export async function importDatabase(data: Record<string, unknown[]>): Promise<void> {
  for (const [storeName, items] of Object.entries(data)) {
    if (Object.values(STORES).includes(storeName as StoreName)) {
      await clear(storeName as StoreName);
      await putMany(storeName as StoreName, items);
    }
  }
}

export async function clearDatabase(): Promise<void> {
  for (const storeName of Object.values(STORES)) {
    await clear(storeName);
  }
}

export async function getDatabaseSize(): Promise<number> {
  if ("storage" in navigator && "estimate" in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return estimate.usage ?? 0;
  }
  return 0;
}
