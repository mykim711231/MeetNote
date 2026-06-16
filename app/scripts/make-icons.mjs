// SVG 소스 아이콘 → PNG 192/512 + apple-touch-icon(180) 생성
// 사용: node scripts/make-icons.mjs  (devDependency: sharp)
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(here, '..', 'public', 'icons');
const svg = readFileSync(join(iconsDir, 'icon.svg'));

const targets = [
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
  { size: 180, name: 'apple-touch-icon.png' },
];

for (const { size, name } of targets) {
  await sharp(svg, { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 79, g: 70, b: 229, alpha: 1 } })
    .png()
    .toFile(join(iconsDir, name));
  console.log(`✓ ${name} (${size}×${size})`);
}
console.log('아이콘 생성 완료');
