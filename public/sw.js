/* Pulse service worker: offline shell + queued check-in replay. */
const SHELL_CACHE = "pulse-shell-v1";
const SHELL_URLS = ["/offline"];

const IDB_NAME = "pulse-queue";
const IDB_STORE = "outbox";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network first, fall back to cached page, then offline shell.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit || caches.match("/offline"))
        )
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.match(/\.(png|svg|webmanifest|css|js|woff2?)$/)) {
    event.respondWith(
      caches.match(req).then((hit) => {
        const refresh = fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(req, copy));
            return res;
          })
          .catch(() => hit);
        return hit || refresh;
      })
    );
  }
});

function openOutbox() {
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

async function flushOutbox() {
  const db = await openOutbox();
  const entries = await new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  for (const entry of entries) {
    try {
      const res = await fetch(entry.url, {
        method: "POST",
        headers: entry.headers,
        body: entry.body,
      });
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        // Delivered, or permanently rejected — either way stop retrying.
        await new Promise((resolve, reject) => {
          const tx = db.transaction(IDB_STORE, "readwrite");
          tx.objectStore(IDB_STORE).delete(entry.id);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      }
    } catch {
      // Still offline — keep it queued; sync will re-fire.
      break;
    }
  }
}

self.addEventListener("sync", (event) => {
  if (event.tag === "pulse-flush") event.waitUntil(flushOutbox());
});

self.addEventListener("message", (event) => {
  if (event.data === "pulse-flush") event.waitUntil?.(flushOutbox()) ?? flushOutbox();
});
