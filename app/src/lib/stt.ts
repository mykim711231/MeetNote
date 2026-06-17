// Web Speech API (SpeechRecognition) 래퍼
// - 무음으로 자동 종료되면 녹음 중에는 자동 재시작
// - 페이지당 인식 1개만 허용되므로 단일 컨트롤러로 관리

// ── 최소 타입 선언 (TS DOM lib에 표준 미포함) ──
interface SRAlternative { transcript: string; confidence: number }
interface SRResult { readonly length: number; isFinal: boolean;[index: number]: SRAlternative }
interface SRResultList { readonly length: number;[index: number]: SRResult }
interface SREvent extends Event { resultIndex: number; results: SRResultList }
interface SRErrorEvent extends Event { error: string }
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
}
type SRCtor = new () => SpeechRecognitionLike;

function getCtor(): SRCtor | null {
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSttSupported(): boolean {
  return getCtor() !== null;
}

export interface SttCallbacks {
  /** 확정된 문장 */
  onFinal: (text: string) => void;
  /** 진행 중(미확정) 텍스트 — UI 미리보기용 */
  onInterim: (text: string) => void;
  /** 복구 불가 오류 (권한 거부 등) */
  onFatal?: (reason: string) => void;
}

/** 웹(Web Speech)·네이티브(Capacitor) 공통 STT 세션 인터페이스 */
export interface SttSession {
  start(): void;
  pause(): void;
  resume(): void;
  stop(): void;
}

export class SttController implements SttSession {
  private rec: SpeechRecognitionLike | null = null;
  private running = false;       // 의도적으로 켜진 상태
  private paused = false;
  private restartTimer: number | null = null;

  constructor(private cb: SttCallbacks, private lang = 'ko-KR') {}

  get supported(): boolean {
    return isSttSupported();
  }

  start(): void {
    const Ctor = getCtor();
    if (!Ctor) return;
    this.running = true;
    this.paused = false;
    this.spawn(Ctor);
  }

  private spawn(Ctor: SRCtor): void {
    if (!this.running || this.paused) return;
    const rec = new Ctor();
    rec.lang = this.lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (e: SREvent) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const txt = r[0]?.transcript ?? '';
        if (r.isFinal) {
          const trimmed = txt.trim();
          if (trimmed) this.cb.onFinal(trimmed);
        } else {
          interim += txt;
        }
      }
      this.cb.onInterim(interim.trim());
    };

    rec.onerror = (e: SRErrorEvent) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        this.running = false;
        this.cb.onFatal?.(e.error);
      }
      // no-speech / aborted / network → onend에서 재시작 처리
    };

    rec.onend = () => {
      this.cb.onInterim('');
      if (this.running && !this.paused) {
        // 무음 종료 → 짧게 후 재시작
        this.restartTimer = window.setTimeout(() => this.spawn(Ctor), 250);
      }
    };

    try {
      rec.start();
      this.rec = rec;
    } catch {
      // 이미 시작된 인스턴스가 있으면 잠시 후 재시도
      this.restartTimer = window.setTimeout(() => this.spawn(Ctor), 300);
    }
  }

  pause(): void {
    this.paused = true;
    this.clearTimer();
    try { this.rec?.stop(); } catch { /* noop */ }
  }

  resume(): void {
    if (!this.running) return;
    this.paused = false;
    const Ctor = getCtor();
    if (Ctor) this.spawn(Ctor);
  }

  stop(): void {
    this.running = false;
    this.paused = false;
    this.clearTimer();
    try { this.rec?.abort(); } catch { /* noop */ }
    this.rec = null;
  }

  private clearTimer(): void {
    if (this.restartTimer !== null) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
  }
}
