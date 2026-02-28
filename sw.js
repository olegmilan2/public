const CACHE_NAME = "stoplist-shell-v4";
const APP_SHELL = [
  "./",
  "./index.html",
  "./offline.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./app-icon-512.png",
  "./app-icon-1024.png",
  "./apple-touch-icon.png"
];

importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyA8VJCylVRlIXgMKZlHWe8pAmu9ZslEPmk",
  authDomain: "check-c1174.firebaseapp.com",
  projectId: "check-c1174",
  storageBucket: "check-c1174.firebasestorage.app",
  messagingSenderId: "620822198863",
  appId: "1:620822198863:web:ab8954aa72bd6cafc1483a",
  measurementId: "G-QWRB5L1N94",
  databaseURL: "https://check-c1174-default-rtdb.firebaseio.com/"
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage(payload => {
  const title = payload?.notification?.title || "Стоп лист";
  const options = {
    body: payload?.notification?.body || "Новое уведомление",
    icon: "./app-icon-512.png",
    badge: "./app-icon-512.png",
    data: payload?.data || {}
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if(event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if(url.origin !== self.location.origin) return;

  // Navigation requests: try network first, fallback to cache/offline page.
  if(event.request.mode === "navigate"){
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match(event.request);
          if(cachedPage) return cachedPage;
          const fallback = await caches.match("./offline.html");
          if(fallback) return fallback;
          return new Response("Offline", { status: 503, statusText: "Offline" });
        })
    );
    return;
  }

  // Static assets: cache first with background refresh.
  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});
