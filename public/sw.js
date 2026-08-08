/* Joy's Food service worker — notifications only.
 *
 * Served from /sw.js on purpose: a service worker can only control pages at or
 * below its own path, so one at /_next/... or /static/... could never receive a
 * push for the site.
 *
 * Deliberately does NOT cache anything. An offline cache on a live ordering site
 * is a way to show someone a sold-out dish or yesterday's price, and the menu is
 * already served fast from the CDN. This worker exists to wake the device up.
 */

self.addEventListener("install", () => {
  // Take over immediately rather than waiting for every old tab to close —
  // otherwise a freshly granted subscription can sit unhandled.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Joy's Food", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Joy's Food";
  const options = {
    body: payload.body || "",
    icon: "/icon.svg",
    badge: "/icon.svg",
    // Same tag replaces an earlier notification instead of stacking six of them
    // for one order. Passed per-event so an order can update its own.
    tag: payload.tag || undefined,
    renotify: Boolean(payload.tag),
    // A new order should survive the screen being off until someone looks.
    requireInteraction: Boolean(payload.requireInteraction),
    data: { url: payload.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Focus an existing tab on the same origin rather than opening a fifth
      // copy of the kitchen screen every time an order arrives.
      for (const client of windows) {
        if (client.url.includes(new URL(target, self.location.origin).pathname)) {
          return client.focus();
        }
      }
      for (const client of windows) {
        if ("navigate" in client) {
          await client.focus();
          return client.navigate(target);
        }
      }
      return self.clients.openWindow(target);
    })(),
  );
});
