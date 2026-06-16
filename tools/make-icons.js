// MeetNote 앱 아이콘 생성기 — 외부 의존성 0 (Node 내장 zlib만 사용)
// 디자인: 네이비 배경 + 종이색 회의록 줄 4개 + 테라코타 브랜드 점("회의록.")
// 4x 슈퍼샘플링 안티앨리어싱 후 PNG(RGBA, color type 6)로 인코딩.
const fs = require("fs");
const zlib = require("zlib");
const path = require("path");

const NAVY  = [0x0f, 0x1a, 0x2e];
const PAPER = [0xf7, 0xf4, 0xec];
const TERRA = [0xc8, 0x55, 0x3d];

// ---- 기하: 크기 비율(fraction) 기반 ----
const X0 = 0.255;            // 줄 시작 x
const BAR_H = 0.066;         // 줄 두께
const BAR_R = BAR_H / 2;
const CENTERS = [0.31, 0.435, 0.56, 0.685];
const WIDTHS  = [0.39, 0.49, 0.435, 0.235];
const DOT_R = 0.055;
const DOT_GAP = 0.02;        // 마지막 줄 끝과 점 사이 간격

function insideRoundRect(px, py, x, y, w, h, r) {
  // (x,y)=좌상단, w,h, r=반경
  const rx = Math.max(x + r, Math.min(px, x + w - r));
  const ry = Math.max(y + r, Math.min(py, y + h - r));
  // 코너 영역
  if (px < x + r || px > x + w - r || py < y + r || py > y + h - r) {
    const dx = px - rx, dy = py - ry;
    return dx * dx + dy * dy <= r * r;
  }
  return true;
}
function insideCircle(px, py, cx, cy, r) {
  const dx = px - cx, dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

// 한 서브픽셀의 색을 결정(위→아래 합성: navy → bars → dot)
function colorAt(u, v) {
  // 점(브랜드 마침표)
  const lastW = WIDTHS[3];
  const dotCx = X0 + lastW + DOT_GAP + DOT_R;
  const dotCy = CENTERS[3];
  if (insideCircle(u, v, dotCx, dotCy, DOT_R)) return TERRA;
  // 줄들
  for (let i = 0; i < CENTERS.length; i++) {
    const y = CENTERS[i] - BAR_H / 2;
    if (insideRoundRect(u, v, X0, y, WIDTHS[i], BAR_H, BAR_R)) return PAPER;
  }
  return NAVY;
}

function render(size) {
  const S = 4; // 슈퍼샘플
  const buf = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const u = (px + (sx + 0.5) / S) / size;
          const v = (py + (sy + 0.5) / S) / size;
          const c = colorAt(u, v);
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const n = S * S;
      const o = (py * size + px) * 4;
      buf[o] = Math.round(r / n);
      buf[o + 1] = Math.round(g / n);
      buf[o + 2] = Math.round(b / n);
      buf[o + 3] = 255;
    }
  }
  return buf;
}

// ---- PNG 인코더 ----
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  // 스캔라인(필터 0)
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

const outDir = path.resolve(__dirname, "..", "assets");
fs.mkdirSync(outDir, { recursive: true });
const sizes = { "icon-512.png": 512, "icon-192.png": 192, "apple-touch-icon.png": 180, "favicon-32.png": 32 };
for (const [name, size] of Object.entries(sizes)) {
  const png = encodePNG(size, render(size));
  fs.writeFileSync(path.join(outDir, name), png);
  console.log(`wrote assets/${name}  ${size}x${size}  ${png.length} bytes`);
}
