// 규칙 기반 요약 · 할 일 추출 (LLM·서버 불필요, 완전 로컬)
import type { Segment } from '@/types';

// 빈도 계산에서 제외할 한국어 불용어 (간이)
const STOPWORDS = new Set([
  '그리고', '그래서', '하지만', '그런데', '저는', '제가', '우리', '그거', '이거', '저거',
  '근데', '그냥', '약간', '뭐', '좀', '이제', '그게', '거기', '여기', '정도', '같아요',
  '있어요', '없어요', '해요', '하는', '하고', '하면', '에서', '으로', '이런', '그런', '저런',
  '네', '예', '아니', '음', '어', '아', '그', '이', '저', '것', '수', '등', '및',
]);

// 문장 분리 마커 — 전사 텍스트에 나타나지 않는 토큰
const SEP = '<<__SENT__>>';

/** 텍스트를 문장 단위로 분리.
 *  lookbehind(?<=)는 Safari 16.3 이하·구형 iOS에서 SyntaxError를 내므로 쓰지 않는다.
 *  대신 문장 종결부 뒤에 분리 마커를 삽입한 뒤 split 한다. */
function splitSentences(text: string): string[] {
  const marked = text
    .replace(/\s+/g, ' ')
    .replace(/([.!?…])\s/g, `$1${SEP}`)
    .replace(/([다요죠음함]\.)\s/g, `$1${SEP}`);
  return marked
    .split(SEP)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4);
}

/** 단어 빈도 맵 (불용어·짧은 토큰 제외) */
function wordFreq(text: string): Map<string, number> {
  const freq = new Map<string, number>();
  const tokens = text.toLowerCase().match(/[가-힣a-z0-9]+/g) ?? [];
  for (const t of tokens) {
    if (t.length < 2 || STOPWORDS.has(t)) continue;
    freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  return freq;
}

/**
 * 빈도 기반 추출 요약.
 * @param max 최대 문장 수
 * @returns 원문 순서를 유지한 핵심 문장 배열
 */
export function summarize(segments: Segment[], max = 5): string[] {
  const full = segments.map((s) => s.text).join(' ');
  const sentences = splitSentences(full);
  if (sentences.length <= max) return sentences;

  const freq = wordFreq(full);
  const scored = sentences.map((sentence, idx) => {
    const tokens = sentence.toLowerCase().match(/[가-힣a-z0-9]+/g) ?? [];
    let score = 0;
    for (const t of tokens) score += freq.get(t) ?? 0;
    const density = tokens.length > 0 ? score / Math.sqrt(tokens.length) : 0;
    return { sentence, idx, score: density };
  });

  const top = [...scored].sort((a, b) => b.score - a.score).slice(0, max);
  top.sort((a, b) => a.idx - b.idx); // 원문 순서 복원
  return top.map((t) => t.sentence);
}

// 할 일/액션아이템 신호 패턴
const ACTION_PATTERNS = [
  /하기로\s*(했|함|하)/, /할게(요)?/, /할\s*예정/, /해야\s*(겠|돼|할|함)/,
  /해\s*주세요/, /부탁(드립|합|해)/, /담당(은|자|이)?/, /까지\s*(완료|제출|보내|마무리|준비)/,
  /진행(하|할|시키)/, /확인(해|하기|바랍|부탁)/, /정리(해|하기|할)/, /공유(해|하기|할|드)/,
  /todo/i, /액션\s*아이템/, /액션아이템/, /\baction\b/i,
];

/** 할 일 후보 문장 추출 */
export function extractTodos(segments: Segment[], max = 12): Array<{ text: string; who: string; ts: number }> {
  const todos: Array<{ text: string; who: string; ts: number }> = [];
  const seen = new Set<string>();
  for (const seg of segments) {
    for (const raw of splitSentences(seg.text)) {
      const sentence = raw.trim();
      if (sentence.length < 4) continue;
      if (!ACTION_PATTERNS.some((re) => re.test(sentence))) continue;
      const norm = sentence.replace(/\s+/g, '');
      if (seen.has(norm)) continue;
      seen.add(norm);
      todos.push({ text: sentence, who: seg.who, ts: seg.ts });
      if (todos.length >= max) return todos;
    }
  }
  return todos;
}
