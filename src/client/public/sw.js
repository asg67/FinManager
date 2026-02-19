const CACHE_NAME = "finmanager-v5";
const STATIC_ASSETS = ["/", "/manifest.json"];

// --- IndexedDB helpers for share target ---
function openShareDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("finmanager-share", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("files");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function saveSharedFile(db, file) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    tx.objectStore("files").put(file, "shared-pdf");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Install: cache shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: handle share target POST, then normal caching
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle Web Share Target POST
  if (request.method === "POST" && url.pathname === "/share-target") {
    event.respondWith(
      (async () => {
        try {
          const formData = await request.formData();
          const file = formData.get("file");
          if (file) {
            const db = await openShareDB();
            await saveSharedFile(db, file);
            db.close();
          }
        } catch (e) {
          console.error("Share target error:", e);
        }
        return Response.redirect("/share-target", 303);
      })()
    );
    return;
  }

  // Skip other non-GET requests
  if (request.method !== "GET") return;

  // API calls and HTML pages: network first
  if (url.pathname.startsWith("/api/") || request.destination === "document") {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Static assets (JS, CSS, images): cache first, then network
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Cache successful responses
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});

// Push notification received
self.addEventListener("push", (event) => {
  let data = { title: "FinManager", body: "" };
  try {
    data = event.data?.json() ?? data;
  } catch (e) {
    data.body = event.data?.text() || "";
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.svg",
      badge: "/icons/icon-192.svg",
      data: { url: data.url || "/" },
    })
  );
});

// Notification click — focus existing window or open new one
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
