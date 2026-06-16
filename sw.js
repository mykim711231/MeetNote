/* MeetNote Service Worker — 바닐라(워크박스 없음).
   전략:
   - HTML 셸(네비게이션·*.html·"/") : 네트워크 우선 → 온라인이면 항상 최신, 오프라인이면 캐시.
     (캐시 우선으로 두면 VERSION을 올리기 전까지 옛 HTML이 영구히 제공되는 함정이 있어 네트워크 우선으로 둠.)
   - 정적 자산(아이콘·매니페스트 등)        : 캐시 우선(불변).
   - 구글폰트                              : stale-while-revalidate(불투명 응답 미캐싱 + 용량 cap).
   - Tesseract(OCR, 대용량·온라인 전용)     : 가로채지 않음(네트워크 직행).
   업데이트: B방식(무음) — install에서 skipWaiting을 호출하지 않아 새 SW는 대기하다 다음 실행 때 활성화. */
const VERSION = "v2";
const SHELL_CACHE = "meetnote-shell-" + VERSION;
const FONT_CACHE = "meetnote-fonts";
const FONT_MAX = 60;
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

  // 구글폰트 — stale-while-revalidate
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(staleWhileRevalidate(req, FONT_CACHE));
    return;
  }

  if (url.origin === self.location.origin) {
    if (req.mode === "navigate" || url.pathname.endsWith(".html") || url.pathname.endsWith("/")) {
      e.respondWith(networkFirst(req));   // HTML 셸 — 네트워크 우선
    } else {
      e.respondWith(cacheFirst(req));     // 정적 자산 — 캐시 우선
    }
  }
  // 그 외 — 기본 네트워크 처리(가로채지 않음)
});

async function networkFirst(req) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(req);
    if (res && res.ok && res.type === "basic") cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === "navigate") return (await cache.match("./meetnote.html")) || Response.error();
    return Response.error();
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(SHELL_CACHE);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && res.ok && res.type === "basic") cache.put(req, res.clone());
    return res;
  } catch (err) {
    return Response.error();
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const fetching = fetch(req).then((res) => {
    // 불투명(no-cors) 응답은 캐시하지 않음 — 할당량 과다 점유 방지
    if (res && res.ok) { cache.put(req, res.clone()).then(() => trimCache(cache, FONT_MAX)); }
    return res;
  }).catch(() => null);
  return hit || (await fetching) || Response.error();
}

async function trimCache(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}
