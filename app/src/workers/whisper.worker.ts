// 온디바이스 Whisper 전사 워커 (transformers.js)
// 메인 스레드를 막지 않도록 Web Worker에서 모델 로드 + 전사를 수행한다.
// 모델은 첫 사용 시 HuggingFace CDN에서 1회 다운로드되어 브라우저에 캐시된다.
import { pipeline, env } from '@huggingface/transformers';

// 로컬 모델 탐색 비활성화(원격 모델만)
env.allowLocalModels = false;

type Transcriber = (audio: Float32Array, opts: Record<string, unknown>) => Promise<{ text: string; chunks?: Array<{ text: string; timestamp: [number, number | null] }> }>;

let transcriber: Transcriber | null = null;
let loadedModel = '';

self.onmessage = async (e: MessageEvent) => {
  const { audio, language, model } = e.data as { audio: Float32Array; language: string; model: string };
  try {
    if (!transcriber || loadedModel !== model) {
      loadedModel = model;
      transcriber = (await pipeline('automatic-speech-recognition', model, {
        progress_callback: (p: unknown) => self.postMessage({ type: 'progress', data: p }),
      })) as unknown as Transcriber;
    }
    const result = await transcriber(audio, {
      return_timestamps: true,
      chunk_length_s: 30,
      stride_length_s: 5,
      language,
      task: 'transcribe',
    });
    self.postMessage({ type: 'done', data: result });
  } catch (err) {
    self.postMessage({ type: 'error', data: String((err as Error)?.message ?? err) });
  }
};
