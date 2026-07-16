/**
 * IndexedDB outbox shared with the service worker (public/sw.js reads the
 * same database). Queued entries are replayed on 'online', on page load, and
 * via Background Sync where available.
 */
const IDB_NAME = "pulse-queue";
const IDB_STORE = "outbox";

export interface OutboxEntry {
  url: string;
  headers: Record<string, string>;
  body: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(IDB_NAME, 1);
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains(IDB_STORE)) {
        open.result.createObjectStore(IDB_STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}

export async function enqueue(entry: OutboxEntry): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).add(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // Prefer real Background Sync; fall back to poking the worker directly.
  try {
    const reg = (await navigator.serviceWorker?.ready) as ServiceWorkerRegistration & {
      sync?: { register(tag: string): Promise<void> };
    };
    if (reg?.sync) await reg.sync.register("pulse-flush");
    else navigator.serviceWorker?.controller?.postMessage("pulse-flush");
  } catch {
    // No SW — the next page load / online event will flush.
  }
}
