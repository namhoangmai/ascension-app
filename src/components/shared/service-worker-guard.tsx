"use client";

import { useEffect } from "react";

export function ServiceWorkerGuard() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || !("serviceWorker" in navigator)) {
      return;
    }

    void navigator.serviceWorker.getRegistrations().then(async (registrations) => {
      await Promise.all(registrations.map((registration) => registration.unregister()));

      if ("caches" in window) {
        const cacheKeys = await window.caches.keys();
        await Promise.all(cacheKeys.map((cacheKey) => window.caches.delete(cacheKey)));
      }
    });
  }, []);

  return null;
}
