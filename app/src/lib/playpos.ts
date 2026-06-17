// 회의별 마지막 재생 위치(ms) — localStorage (작은 데이터)
const KEY = 'meetnote.playpos.v1';

function read(): Record<string, number> {
  try {
    const raw = localStorage.getItem(KEY);
    const o = raw ? JSON.parse(raw) : {};
    return o && typeof o === 'object' ? (o as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function write(o: Record<string, number>): void {
  try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* noop */ }
}

export function getPlayPos(id: number): number {
  const v = read()[String(id)];
  return typeof v === 'number' && v > 0 ? v : 0;
}

export function setPlayPos(id: number, ms: number): void {
  const o = read();
  if (ms <= 1500) delete o[String(id)]; // 처음 부근이면 저장 안 함
  else o[String(id)] = Math.round(ms);
  write(o);
}

export function clearPlayPos(id: number): void {
  const o = read();
  if (String(id) in o) { delete o[String(id)]; write(o); }
}
