// 클라우드 STT — Groq Whisper(빠른 전사) + AssemblyAI(화자 분리)
// 무료 티어: Groq=플랜당 한도, AssemblyAI=100시간/달
// 두 경우 모두 오디오 파일이 외부 서버로 전송됩니다.
import type { Segment } from '@/types';

// ─── Groq Whisper ────────────────────────────────────────────────────────────

/** Groq Whisper API로 전사. verbose_json → 타임스탬프 포함 세그먼트 반환 */
export async function transcribeWithGroq(
  blob: Blob,
  audioType: string,
  lang: string,
  groqKey: string,
): Promise<Segment[]> {
  const ext = audioType.includes('mp4') || audioType.includes('m4a') ? 'm4a'
    : audioType.includes('ogg') ? 'ogg'
    : audioType.includes('wav') ? 'wav'
    : 'webm';
  const file = new File([blob], `audio.${ext}`, { type: audioType });

  const form = new FormData();
  form.append('file', file);
  form.append('model', 'whisper-large-v3-turbo');
  form.append('response_format', 'verbose_json');
  const langCode = lang.split('-')[0]; // 'ko-KR' → 'ko'
  form.append('language', langCode);

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${groqKey}` },
    body: form,
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error('Groq API 키가 올바르지 않습니다.');
    if (res.status === 413) throw new Error('오디오 파일이 너무 큽니다 (25MB 제한). 짧은 녹음을 시도하세요.');
    if (res.status === 429) throw new Error('Groq 한도 초과. 잠시 후 다시 시도하세요.');
    let detail = '';
    try { detail = (await res.text()).slice(0, 200); } catch { /* noop */ }
    throw new Error(`Groq 전사 실패 (${res.status})${detail ? `: ${detail}` : ''}`);
  }

  const data = await res.json();
  // verbose_json: { segments: [{ start, end, text }] }
  const raw: Array<{ start: number; end: number; text: string }> = data.segments ?? [];
  if (!raw.length && data.text) {
    return [{ who: '발언자', text: (data.text as string).trim(), ts: 0 }];
  }
  return raw
    .filter((s) => s.text.trim().length > 0)
    .map((s) => ({ who: '발언자', text: s.text.trim(), ts: Math.round(s.start * 1000) }));
}

// ─── AssemblyAI (화자 분리) ───────────────────────────────────────────────────

const AAI_BASE = 'https://api.assemblyai.com/v2';

function aaiHeaders(key: string): Record<string, string> {
  return { Authorization: key, 'Content-Type': 'application/json' };
}

/** AssemblyAI에 오디오 업로드 → upload_url 반환 */
async function uploadAudio(blob: Blob, key: string): Promise<string> {
  const res = await fetch(`${AAI_BASE}/upload`, {
    method: 'POST',
    headers: { Authorization: key, 'Content-Type': blob.type || 'application/octet-stream' },
    body: blob,
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('AssemblyAI API 키가 올바르지 않습니다.');
    throw new Error(`AssemblyAI 업로드 실패 (${res.status})`);
  }
  const { upload_url } = await res.json();
  return upload_url as string;
}

/** 전사 요청 제출 → transcript id 반환 */
async function submitTranscript(uploadUrl: string, lang: string, key: string): Promise<string> {
  const langCode = lang.split('-')[0];
  const body: Record<string, unknown> = {
    audio_url: uploadUrl,
    speaker_labels: true,
  };
  // AssemblyAI 지원 언어 코드 매핑 (미지원 언어는 자동 감지)
  const supported = ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'hi', 'ja', 'zh', 'fi', 'ko', 'pl', 'ru', 'tr', 'uk', 'vi'];
  if (supported.includes(langCode)) body.language_code = langCode;

  const res = await fetch(`${AAI_BASE}/transcript`, {
    method: 'POST',
    headers: aaiHeaders(key),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    if (res.status === 400) throw new Error('AssemblyAI: 오디오 형식이 지원되지 않습니다.');
    throw new Error(`AssemblyAI 전사 요청 실패 (${res.status})`);
  }
  const { id } = await res.json();
  return id as string;
}

/** polling — 최대 10분, 5초 간격 */
async function pollTranscript(
  id: string,
  key: string,
  onProgress: (msg: string) => void,
): Promise<unknown> {
  const MAX_ATTEMPTS = 120; // 5s × 120 = 10분
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const res = await fetch(`${AAI_BASE}/transcript/${id}`, {
      headers: { Authorization: key, 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`AssemblyAI 상태 조회 실패 (${res.status})`);
    const data = await res.json();
    if (data.status === 'completed') return data;
    if (data.status === 'error') throw new Error(`AssemblyAI 전사 오류: ${data.error ?? '알 수 없는 오류'}`);
    const pct = data.status === 'processing' ? ` ${Math.min(90, i * 3)}%` : '';
    onProgress(`전사 중…${pct}`);
  }
  throw new Error('AssemblyAI 전사 시간 초과 (10분)');
}

/**
 * AssemblyAI로 화자 분리 포함 전사.
 * 결과: utterances → Segment[] (who=발언자A/B/…, ts=ms)
 */
export async function transcribeWithAssemblyAI(
  blob: Blob,
  lang: string,
  aaiKey: string,
  onProgress: (msg: string) => void,
): Promise<Segment[]> {
  onProgress('오디오 업로드 중…');
  const uploadUrl = await uploadAudio(blob, aaiKey);

  onProgress('전사 요청 중…');
  const transcriptId = await submitTranscript(uploadUrl, lang, aaiKey);

  onProgress('전사 중…');
  const data = await pollTranscript(transcriptId, aaiKey, onProgress) as {
    utterances?: Array<{ speaker: string; text: string; start: number }>;
    text?: string;
  };

  // 화자 분리 결과: utterances
  if (data.utterances && data.utterances.length > 0) {
    return data.utterances
      .filter((u) => u.text.trim().length > 0)
      .map((u) => ({
        who: `발언자 ${u.speaker}`,
        text: u.text.trim(),
        ts: Math.round(u.start), // AssemblyAI는 이미 ms
      }));
  }
  // 폴백: 화자 분리 없는 단일 텍스트
  if (data.text) return [{ who: '발언자', text: data.text.trim(), ts: 0 }];
  throw new Error('AssemblyAI 전사 결과가 비어 있습니다.');
}
