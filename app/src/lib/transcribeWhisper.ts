// 웹 온디바이스 Whisper 전사 — 오디오 Blob을 16kHz mono로 디코드 후 워커에서 전사.
// 동적 import로만 로드되어 기본 번들에는 포함되지 않는다(첫 전사 시에만 로드).
import type { Segment } from '@/types';

const DEFAULT_MODEL = 'Xenova/whisper-base';

// 자막 언어(ko-KR 등) → Whisper 언어명
function whisperLang(code: string): string {
  const m: Record<string, string> = { ko: 'korean', en: 'english', ja: 'japanese', zh: 'chinese' };
  return m[code.slice(0, 2).toLowerCase()] ?? 'korean';
}

/** Blob → 16kHz mono Float32Array */
async function decodeTo16kMono(blob: Blob): Promise<Float32Array> {
  const arrayBuf = await blob.arrayBuffer();
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const tmp = new Ctx();
  const decoded = await tmp.decodeAudioData(arrayBuf.slice(0));
  void tmp.close();
  const targetRate = 16000;
  const frames = Math.ceil(decoded.duration * targetRate);
  const offline = new OfflineAudioContext(1, Math.max(1, frames), targetRate);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start();
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0).slice();
}

export interface WhisperProgress {
  status: string;       // 'progress' | 'done' | 'ready' 등
  file?: string;
  progress?: number;    // 0~100 (다운로드)
}

/** 온디바이스 Whisper로 전사 → Segment[] */
export async function transcribeWithWhisper(
  blob: Blob,
  langCode: string,
  onProgress?: (p: WhisperProgress) => void,
  model: string = DEFAULT_MODEL,
): Promise<Segment[]> {
  const audio = await decodeTo16kMono(blob);
  const worker = new Worker(new URL('../workers/whisper.worker.ts', import.meta.url), { type: 'module' });

  return new Promise<Segment[]>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent) => {
      const { type, data } = e.data as { type: string; data: unknown };
      if (type === 'progress') {
        onProgress?.(data as WhisperProgress);
      } else if (type === 'done') {
        worker.terminate();
        const res = data as { text: string; chunks?: Array<{ text: string; timestamp: [number, number | null] }> };
        const chunks = res.chunks ?? [];
        const segs: Segment[] = chunks
          .map((c) => ({ who: '화자', text: (c.text ?? '').trim(), ts: Math.max(0, Math.round((c.timestamp?.[0] ?? 0) * 1000)) }))
          .filter((s) => s.text);
        if (segs.length === 0 && res.text?.trim()) {
          segs.push({ who: '화자', text: res.text.trim(), ts: 0 });
        }
        resolve(segs);
      } else if (type === 'error') {
        worker.terminate();
        reject(new Error(String(data)));
      }
    };
    worker.onerror = (err) => { worker.terminate(); reject(err.error ?? new Error('worker error')); };
    worker.postMessage({ audio, language: whisperLang(langCode), model }, [audio.buffer]);
  });
}
