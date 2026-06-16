// 발언자 색상 매핑 + 발언 비중 계산
import type { Segment } from '@/types';

// 라이트/다크 모두에서 식별되는 8색 팔레트
const PALETTE = ['#4f46e5', '#0891b2', '#db2777', '#ea580c', '#16a34a', '#9333ea', '#ca8a04', '#dc2626'];

/** 발언자 이름 → 안정적 색상 */
export function speakerColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export interface TalkShare {
  who: string;
  chars: number;
  pct: number;
  color: string;
}

/** 발언자별 발언량 비중 (글자 수 기준 근사) */
export function talkShares(segments: Segment[]): TalkShare[] {
  const map = new Map<string, number>();
  for (const s of segments) {
    map.set(s.who, (map.get(s.who) ?? 0) + s.text.length);
  }
  const total = [...map.values()].reduce((a, b) => a + b, 0);
  if (total === 0) return [];
  return [...map.entries()]
    .map(([who, chars]) => ({ who, chars, pct: Math.round((chars / total) * 100), color: speakerColor(who) }))
    .sort((a, b) => b.chars - a.chars);
}
