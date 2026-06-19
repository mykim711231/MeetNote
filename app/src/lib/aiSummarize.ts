// 무료 LLM API 기반 AI 요약 (옵트인 · 하이브리드)
// 키가 설정돼 있을 때만 호출된다. 키가 없으면 호출부에서 규칙 기반 요약(summarize.ts)을 쓴다.
// 데이터는 사용자가 선택한 제공자(Gemini/Groq) 서버로 전송된다 — 프라이버시 트레이드오프.
import type { AiProvider } from '@/stores/usePrefStore';
import { aiModelFor } from '@/stores/usePrefStore';
import type { AiSummary, Segment } from '@/types';

// LLM이 채워야 할 JSON 형태 (model·at은 호출부에서 부여)
type AiCore = Omit<AiSummary, 'model' | 'at'>;

const SYSTEM = `너는 회의록 분석 도우미다. 주어진 대화 전사를 읽고 한국어로 핵심을 정리한다.
반드시 아래 JSON 스키마만 출력한다. 마크다운·설명·코드펜스 없이 JSON 객체 하나만 출력한다.
{
  "tldr": "회의 전체를 한 문장으로 요약",
  "keyPoints": ["핵심 논의 3~6개, 각 항목은 한 문장"],
  "decisions": ["확정된 결정 사항(없으면 빈 배열)"],
  "todos": [{ "text": "해야 할 일", "who": "담당자(불명확하면 생략)" }]
}
없는 항목은 빈 배열로 둔다. 추측해서 지어내지 않는다.`;

/** 전사를 "발언자: 내용" 한 줄씩으로 — 화자 정보 포함, 토큰 절약 위해 타임스탬프 제외 */
function buildTranscript(segments: Segment[]): string {
  return segments
    .map((s) => `${s.who}: ${s.text.trim()}`)
    .filter((l) => l.length > 3)
    .join('\n');
}

/** LLM 응답 텍스트에서 JSON 객체를 안전하게 파싱 (코드펜스·잡텍스트 방어) */
function parseCore(raw: string): AiCore {
  let text = raw.trim();
  // ```json ... ``` 펜스 제거
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  // 첫 { 부터 마지막 } 까지만
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) text = text.slice(start, end + 1);
  const obj = JSON.parse(text) as Partial<AiCore>;
  const strArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];
  return {
    tldr: typeof obj.tldr === 'string' ? obj.tldr.trim() : '',
    keyPoints: strArr(obj.keyPoints),
    decisions: strArr(obj.decisions),
    todos: Array.isArray(obj.todos)
      ? obj.todos
          .map((t) => {
            const text = typeof t?.text === 'string' ? t.text.trim() : String(t ?? '').trim();
            const who = typeof t?.who === 'string' && t.who.trim() ? t.who.trim() : undefined;
            return { text, who };
          })
          .filter((t) => t.text.length > 0)
      : [],
  };
}

async function callGemini(model: string, key: string, transcript: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: transcript }] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) throw new Error(await errMsg(res, 'Gemini'));
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
  if (!text) throw new Error('Gemini 응답이 비어 있습니다.');
  return text;
}

async function callGroq(model: string, key: string, transcript: string): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: transcript },
      ],
    }),
  });
  if (!res.ok) throw new Error(await errMsg(res, 'Groq'));
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content ?? '';
  if (!text) throw new Error('Groq 응답이 비어 있습니다.');
  return text;
}

/** HTTP 오류를 사용자에게 보여줄 한국어 메시지로 변환 */
async function errMsg(res: Response, name: string): Promise<string> {
  if (res.status === 401 || res.status === 403) return `${name} API 키가 올바르지 않습니다.`;
  if (res.status === 429) return `${name} 무료 사용 한도를 초과했어요. 잠시 후 다시 시도하세요.`;
  let detail = '';
  try { detail = (await res.text()).slice(0, 200); } catch { /* noop */ }
  return `${name} 요청 실패 (${res.status})${detail ? `: ${detail}` : ''}`;
}

/**
 * AI 요약 생성. 키가 비어 있으면 호출하지 말 것(호출부 책임).
 * @throws 네트워크/인증/한도 오류 — 호출부에서 토스트로 안내
 */
export async function aiSummarize(
  segments: Segment[],
  provider: AiProvider,
  key: string,
): Promise<AiSummary> {
  const transcript = buildTranscript(segments);
  if (transcript.length < 10) throw new Error('요약할 전사 내용이 부족합니다.');
  const model = aiModelFor(provider);
  const raw = provider === 'groq'
    ? await callGroq(model, key, transcript)
    : await callGemini(model, key, transcript);
  const core = parseCore(raw);
  if (!core.tldr && core.keyPoints.length === 0) throw new Error('요약 결과를 해석하지 못했어요.');
  return { ...core, model, at: new Date().toISOString() };
}
