/// <reference lib="WebWorker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// 정적 에셋 프리캐시
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// SPA 네비게이션 폴백 — index.html 서빙
registerRoute(
  new NavigationRoute(
    new NetworkFirst({ cacheName: 'navigation' }),
    { denylist: [/^\/(api|_)\//] },
  ),
);

// Web Share Target: iOS 음성 메모 → 공유 → MeetNote
// iOS는 POST multipart/form-data로 파일을 전달
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'POST') return;
  const url = new URL(event.request.url);
  if (!url.pathname.endsWith('/share-target')) return;

  event.respondWith(
    (async () => {
      try {
        const formData = await event.request.formData();
        const file = formData.get('file') as File | null;
        if (file && file.size > 0) {
          const cache = await caches.open('meetnote-share-v1');
          await cache.put(
            'pending',
            new Response(file, {
              headers: {
                'Content-Type': file.type || 'audio/mp4',
                'X-Filename': encodeURIComponent(file.name),
              },
            }),
          );
        }
      } catch { /* noop */ }
      // 앱으로 리다이렉트 (scope = 배포 base URL)
      return Response.redirect(`${self.registration.scope}#/library?share=1`, 303);
    })(),
  );
});
