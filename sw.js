/* MeetNote Service Worker — 바닐라(워크박스 없음).
   전략: 앱 셸 precache + 캐시 우선, 구글폰트 stale-while-revalidate,
        Tesseract(OCR, 대용량·온라인 전용)는 캐시하지 않음.
   업데이트: B방식(무음) — install에서 skipWaiting을 호출하지 않아
            새 SW는 대기하다가 다음 실행 때 자연 활성화된다. */
const VERSION = "v1";
const SHELL_CACHE = "meetnote-shell-" + VERSION;
const FONT_CACHE = "meetnote-fonts";
const SHELL = [
  "./", "./index.html", "./meetnote.html", "./manifest.webmanifest",
  "./assets/icon.svg", "./assets/icon-192.png", "./assets/icon-512.png",
  "./assets/apple-touch-icon.png", "./assets/favicon-32.png"
];

self.addEventListener("install", (e) => {
  // skipWaiting() 호출 안 함 → B방식 무음 업데이트
  e.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map((k) => (k.startsWith("meetnote-shell-") && k !== SHELL_CACHE) ? caches.delete(k) : Promise.resolve())
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Tesseract OCR 엔진(수~십 MB, 온라인 전용) — 캐시하지 않고 네트워크 직행
  if (url.hostname === "cdn.jsdelivr.net") return;

  // 구글폰트 — stale-while-revalidate (첫 로드 후 오프라인에서도 글꼴 유지)
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(staleWhileRevalidate(req, FONT_CACHE));
    return;
  }

  // 같은 오리진 — 캐시 우선(앱 셸), 오프라인 네비게이션 폴백 포함
  if (url.origin === self.location.origin) {
    e.respondWith(cacheFirst(req));
  }
  // 그 외 — 기본 네트워크 처리(가로채지 않음)
});

async function cacheFirst(req) {
  const cache = await caches.open(SHELL_CACHE);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && res.ok && res.type === "basic") cache.put(req, res.clone());
    return res;
  } catch (err) {
    if (req.mode === "navigate") {
      return (await cache.match("./meetnote.html")) ||
             (await cache.match("./index.html")) ||
             Response.error();
    }
    return Response.error();
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const fetching = fetch(req).then((res) => {
    if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  return hit || (await fetching) || Response.error();
}
