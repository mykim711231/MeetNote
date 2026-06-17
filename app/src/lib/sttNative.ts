// 네이티브 음성 인식 (Capacitor: iOS SFSpeechRecognizer / Android SpeechRecognizer)
// 웹의 SttController와 동일한 SttSession 인터페이스를 구현해 useRecorder에서 동일하게 사용.
// iOS WKWebView에는 Web Speech API가 없으므로 네이티브 플러그인이 자막의 핵심 경로다.
//
// ⚠️ 이 파일의 동작은 실기기(iOS/Android)에서만 검증 가능하다. 웹 빌드에는 동적 import로만 들어와
//    웹 동작에는 영향을 주지 않는다.

import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import type { SttCallbacks, SttSession } from './stt';

export class NativeSttController implements SttSession {
  private running = false;
  private paused = false;
  private lastPartial = '';
  private restartTimer: number | null = null;
  private listenersBound = false;

  constructor(private cb: SttCallbacks, private lang = 'ko-KR') {}

  start(): void {
    this.running = true;
    this.paused = false;
    void (async () => {
      try {
        const avail = await SpeechRecognition.available();
        if (!avail.available) { this.running = false; this.cb.onFatal?.('unavailable'); return; }
        const perm = await SpeechRecognition.requestPermissions();
        if (perm.speechRecognition !== 'granted') { this.running = false; this.cb.onFatal?.('not-allowed'); return; }
        await this.bindListeners();
        this.spawn();
      } catch {
        this.running = false;
        this.cb.onFatal?.('error');
      }
    })();
  }

  private async bindListeners(): Promise<void> {
    if (this.listenersBound) return;
    this.listenersBound = true;
    // 진행 중 인식 결과(부분)
    await SpeechRecognition.addListener('partialResults', (data: { matches?: string[] }) => {
      const t = (data.matches?.[0] ?? '').trim();
      this.lastPartial = t;
      this.cb.onInterim(t);
    });
    // 세션 종료 감지(iOS는 ~1분 제한 등으로 멈춤) → 마지막 부분을 확정하고 재시작
    await SpeechRecognition.addListener('listeningState', (data: { status?: string }) => {
      if (data.status === 'stopped' && this.running && !this.paused) {
        this.commitAndRestart();
      }
    });
  }

  private spawn(): void {
    if (!this.running || this.paused) return;
    void SpeechRecognition.start({ language: this.lang, partialResults: true, popup: false }).catch(() => {
      // 세션 시작 실패 → listeningState 또는 짧은 후 재시도
      if (this.running && !this.paused) this.restartTimer = window.setTimeout(() => this.spawn(), 400);
    });
  }

  private commitFinal(): void {
    if (this.lastPartial) {
      this.cb.onFinal(this.lastPartial);
      this.lastPartial = '';
      this.cb.onInterim('');
    }
  }

  private commitAndRestart(): void {
    this.commitFinal();
    this.restartTimer = window.setTimeout(() => this.spawn(), 250);
  }

  pause(): void {
    this.paused = true;
    this.clearTimer();
    this.commitFinal();
    void SpeechRecognition.stop().catch(() => {});
  }

  resume(): void {
    if (!this.running) return;
    this.paused = false;
    this.spawn();
  }

  stop(): void {
    this.running = false;
    this.paused = false;
    this.clearTimer();
    this.commitFinal();
    void SpeechRecognition.stop().catch(() => {});
    if (this.listenersBound) {
      void SpeechRecognition.removeAllListeners().catch(() => {});
      this.listenersBound = false;
    }
  }

  private clearTimer(): void {
    if (this.restartTimer !== null) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
  }
}
