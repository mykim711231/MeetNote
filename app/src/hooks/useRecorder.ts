import { useCallback, useEffect, useRef, useState } from 'react';
import type { Segment } from '@/types';
import { Capacitor } from '@capacitor/core';
import { SttController, isSttSupported, type SttSession } from '@/lib/stt';
import { appendDraftChunk, saveDraftMeta, clearDraft } from '@/lib/db';
import { usePrefStore } from '@/stores/usePrefStore';
import { useWakeLock } from './useWakeLock';

export type RecState = 'idle' | 'recording' | 'paused';
export type RecSource = 'mic' | 'system' | 'both';

export interface RecorderResult {
  blob: Blob | null;
  audioType: string;
  duration: number;
  segments: Segment[];
}

/** MediaRecorder가 지원하는 mime 선택 (Chrome=webm, Safari=mp4) */
function pickMime(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  for (const t of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

export function useRecorder() {
  const [state, setState] = useState<RecState>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [level, setLevel] = useState(0);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 웹: Web Speech API / 네이티브(iOS·Android): Capacitor 음성인식 플러그인
  const sttSupported = isSttSupported() || Capacitor.isNativePlatform();

  // ── 내부 ref ──
  const streamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);     // 'both' 분리 정리용
  const displayStreamRef = useRef<MediaStream | null>(null); // 시스템 소리 트랙
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const mimeRef = useRef('');
  const sttRef = useRef<SttSession | null>(null);
  const segmentsRef = useRef<Segment[]>([]);
  const speakerRef = useRef('나');

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastCommitRef = useRef(0);

  // 경과시간 누적
  const accumRef = useRef(0);       // 이전 구간까지 누적(ms)
  const runStartRef = useRef(0);    // 현재 구간 시작 시각(perf)
  const runningRef = useRef(false); // 타이머 진행 여부
  const startingRef = useRef(false); // start() 동시 호출 가드
  const draftSeqRef = useRef(0);     // 크래시 복구용 청크 시퀀스

  const wakeLock = useWakeLock();

  const getElapsed = useCallback((): number => {
    return accumRef.current + (runningRef.current ? performance.now() - runStartRef.current : 0);
  }, []);

  const setSpeaker = useCallback((who: string) => {
    speakerRef.current = who || '나';
  }, []);

  // ── 측정 루프 (경과시간 + 레벨, ~10fps 커밋) ──
  const loop = useCallback(() => {
    const analyser = analyserRef.current;
    let rms = 0;
    if (analyser) {
      const buf = new Uint8Array(analyser.fftSize);
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      rms = Math.min(1, Math.sqrt(sum / buf.length) * 2.2);
    }
    const now = performance.now();
    if (now - lastCommitRef.current >= 90) {
      lastCommitRef.current = now;
      setLevel(rms);
      if (runningRef.current) setElapsedMs(getElapsed());
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [getElapsed]);

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const pushFinal = useCallback((text: string) => {
    const seg: Segment = { who: speakerRef.current, text, ts: getElapsed() };
    segmentsRef.current = [...segmentsRef.current, seg];
    setSegments(segmentsRef.current);
    // 드래프트 메타 갱신 (크래시 복구용)
    void saveDraftMeta({ segments: segmentsRef.current, duration: getElapsed(), audioType: mimeRef.current, updatedAt: Date.now() });
  }, [getElapsed]);

  const start = useCallback(async (speaker: string, source: RecSource = 'mic') => {
    if (state !== 'idle' || startingRef.current) return; // 비동기 await 중 stale state로 인한 이중 시작 방지
    startingRef.current = true;
    setError(null);
    speakerRef.current = speaker || '나';
    segmentsRef.current = [];
    setSegments([]);
    setInterim('');
    chunksRef.current = [];
    accumRef.current = 0;
    draftSeqRef.current = 0;
    await clearDraft().catch(() => {}); // 이전 드래프트 제거 후 새 녹음

    const useMic = source === 'mic' || source === 'both';
    const useSystem = source === 'system' || source === 'both';
    const denoise = usePrefStore.getState().denoise;
    let stream: MediaStream;
    try {
      if (useMic) {
        // denoise=off면 AEC/NS/AGC 모두 끔 → 마이크가 "통화 모드"로 전환되지 않아
        // 동시 실행되는 SpeechRecognition이 원거리(회의실) 음성을 더 잘 잡는다.
        micStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: denoise, noiseSuppression: denoise, autoGainControl: denoise },
        });
      }
      if (useSystem) {
        const disp = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
        disp.getVideoTracks().forEach((t) => t.stop()); // 영상은 불필요
        if (disp.getAudioTracks().length === 0) {
          disp.getTracks().forEach((t) => t.stop());
          throw new DOMException('시스템 소리를 캡처하지 못했습니다. 공유 시 "탭/시스템 오디오 공유"를 켜세요.', 'NotFoundError');
        }
        displayStreamRef.current = new MediaStream(disp.getAudioTracks());
      }
      // 믹스('both')거나 노이즈 감소(denoise)면 AudioContext 처리 그래프를 거쳐 녹음.
      // denoise: 각 소스에 하이패스(85Hz) 필터로 저주파 험·웅웅거림 제거. 메터도 같은 컨텍스트에서 탭.
      const needsGraph = source === 'both' || denoise;
      if (needsGraph) {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        audioCtxRef.current = ctx;
        await ctx.resume().catch(() => {}); // suspended 상태로 시작 시 무음 방지
        const dest = ctx.createMediaStreamDestination();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        const inputs = [micStreamRef.current, displayStreamRef.current].filter((s): s is MediaStream => !!s);
        for (const s of inputs) {
          let node: AudioNode = ctx.createMediaStreamSource(s);
          if (denoise) {
            const hp = ctx.createBiquadFilter();
            hp.type = 'highpass';
            hp.frequency.value = 85;
            node.connect(hp);
            node = hp;
          }
          node.connect(dest);
          node.connect(analyser);
        }
        analyserRef.current = analyser;
        stream = dest.stream;
      } else if (source === 'system') {
        stream = displayStreamRef.current!;
      } else {
        stream = micStreamRef.current!;
      }
    } catch (e) {
      // 부분 취득 정리
      micStreamRef.current?.getTracks().forEach((t) => t.stop()); micStreamRef.current = null;
      displayStreamRef.current?.getTracks().forEach((t) => t.stop()); displayStreamRef.current = null;
      if (audioCtxRef.current) { void audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
      analyserRef.current = null;
      const name = (e as DOMException)?.name ?? '';
      const msg = (e as DOMException)?.message;
      setError(
        name === 'NotAllowedError'
          ? (source === 'mic' ? '마이크 권한이 거부되었습니다. 브라우저 설정에서 허용해 주세요.' : '화면/소리 공유가 취소되었거나 거부되었습니다.')
          : (msg || '오디오 소스를 사용할 수 없습니다. (장치 없음 또는 점유 중)')
      );
      startingRef.current = false;
      return;
    }
    streamRef.current = stream;

    // 사용자가 브라우저 "공유 중지"로 시스템 소리 트랙을 끝내면 처리
    if (displayStreamRef.current) {
      displayStreamRef.current.getAudioTracks().forEach((t) =>
        t.addEventListener('ended', () => {
          if (!mediaRef.current) return;
          if (source === 'both') {
            // 마이크는 살아 있으므로 녹음 계속, 안내만
            setError('시스템 소리 공유가 중단되어 이후로는 마이크만 녹음됩니다.');
            return;
          }
          // 'system': 더 녹음할 소스가 없으므로 일시정지
          accumRef.current = getElapsed();
          runningRef.current = false;
          try { mediaRef.current.pause(); } catch { /* 이미 inactive */ }
          sttRef.current?.pause();
          setError('화면 공유가 중단되었습니다. 저장하려면 저장 버튼을 누르세요.');
          setState('paused');
        }, { once: true })
      );
    }

    // 레벨 미터 — 처리 그래프(denoise/both)에서 이미 만들었으면 건너뜀
    if (!analyserRef.current) {
      try {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        audioCtxRef.current = ctx; // resume() 실패 시에도 teardown이 close() 할 수 있도록 먼저 저장
        await ctx.resume();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        src.connect(analyser);
        analyserRef.current = analyser;
      } catch { /* 레벨 미터 없이도 동작 */ }
    }

    // MediaRecorder
    const mime = pickMime();
    mimeRef.current = mime;
    try {
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mr.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunksRef.current.push(ev.data);
          // 크래시 복구: 청크를 도착 즉시 IndexedDB에 적재
          void appendDraftChunk(draftSeqRef.current++, ev.data);
          void saveDraftMeta({ segments: segmentsRef.current, duration: getElapsed(), audioType: mimeRef.current, updatedAt: Date.now() });
        }
      };
      mr.start(1000); // 1초마다 청크 → 크래시 시 손실 최소화
      mediaRef.current = mr;
    } catch {
      setError('이 브라우저는 오디오 녹음을 지원하지 않습니다.');
      stream.getTracks().forEach((t) => t.stop());
      micStreamRef.current?.getTracks().forEach((t) => t.stop()); micStreamRef.current = null;
      displayStreamRef.current?.getTracks().forEach((t) => t.stop()); displayStreamRef.current = null;
      if (audioCtxRef.current) { void audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
      analyserRef.current = null;
      startingRef.current = false;
      return;
    }

    // STT — 마이크가 포함된 소스에서만 (시스템 소리는 음성인식 입력 불가)
    if (sttSupported && useMic) {
      const cb = { onFinal: pushFinal, onInterim: setInterim, onFatal: () => setInterim('') };
      const lang = usePrefStore.getState().sttLang;
      let ctrl: SttSession;
      if (Capacitor.isNativePlatform()) {
        // iOS WKWebView엔 Web Speech가 없으므로 네이티브 플러그인 사용(동적 import → 웹 번들 제외)
        const { NativeSttController } = await import('@/lib/sttNative');
        ctrl = new NativeSttController(cb, lang);
      } else {
        ctrl = new SttController(cb, lang);
      }
      ctrl.start();
      sttRef.current = ctrl;
    }

    // 타이머 시작
    accumRef.current = 0;
    runStartRef.current = performance.now();
    runningRef.current = true;
    lastCommitRef.current = 0;
    setElapsedMs(0);
    rafRef.current = requestAnimationFrame(loop);

    void wakeLock.acquire();
    setState('recording');
    startingRef.current = false;
  }, [state, sttSupported, pushFinal, loop, wakeLock]);

  const pause = useCallback(() => {
    if (state !== 'recording') return;
    try { mediaRef.current?.pause(); } catch { /* noop */ }
    sttRef.current?.pause();
    // 타이머 누적
    accumRef.current = getElapsed();
    runningRef.current = false;
    setState('paused');
  }, [state, getElapsed]);

  const resume = useCallback(() => {
    if (state !== 'paused') return;
    try { mediaRef.current?.resume(); } catch { /* noop */ }
    sttRef.current?.resume();
    runStartRef.current = performance.now();
    runningRef.current = true;
    void wakeLock.acquire();
    setState('recording');
  }, [state, wakeLock]);

  // 모든 자원 정리 (stop/cancel 공통)
  const teardown = useCallback(() => {
    stopLoop();
    runningRef.current = false;
    startingRef.current = false;
    sttRef.current?.stop();
    sttRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    displayStreamRef.current?.getTracks().forEach((t) => t.stop());
    displayStreamRef.current = null;
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    wakeLock.release();
    setLevel(0);
    setInterim('');
  }, [stopLoop, wakeLock]);

  const stop = useCallback((): Promise<RecorderResult | null> => {
    return new Promise((resolve) => {
      const mr = mediaRef.current;
      const duration = getElapsed();
      // 측정 루프·타이머 즉시 정지 (onstop 대기 중 불필요한 setState 방지)
      runningRef.current = false;
      stopLoop();
      if (!mr) {
        teardown();
        setState('idle');
        resolve(null);
        return;
      }
      // 트랙 종료(공유 중지)로 레코더가 이미 inactive면 onstop이 안 오므로 즉시 결과 구성
      if (mr.state === 'inactive') {
        const type = mimeRef.current || mr.mimeType || 'audio/webm';
        const blob = chunksRef.current.length ? new Blob(chunksRef.current, { type }) : null;
        const result: RecorderResult = { blob, audioType: type, duration, segments: segmentsRef.current };
        chunksRef.current = [];
        mediaRef.current = null;
        teardown();
        setState('idle');
        setElapsedMs(0);
        resolve(result);
        return;
      }
      mr.onstop = () => {
        const type = mimeRef.current || mr.mimeType || 'audio/webm';
        const blob = chunksRef.current.length ? new Blob(chunksRef.current, { type }) : null;
        const result: RecorderResult = { blob, audioType: type, duration, segments: segmentsRef.current };
        chunksRef.current = [];
        mediaRef.current = null;
        teardown();
        setState('idle');
        setElapsedMs(0);
        resolve(result);
      };
      try {
        mr.stop();
      } catch {
        mr.onstop = null;
        mediaRef.current = null;
        teardown();
        setState('idle');
        resolve(null);
      }
    });
  }, [getElapsed, teardown, stopLoop]);

  const cancel = useCallback(() => {
    const mr = mediaRef.current;
    if (mr) {
      mr.onstop = null;
      try { mr.stop(); } catch { /* noop */ }
    }
    mediaRef.current = null;
    chunksRef.current = [];
    segmentsRef.current = [];
    setSegments([]);
    teardown();
    setState('idle');
    setElapsedMs(0);
    void clearDraft();
  }, [teardown]);

  // 언마운트 시 강제 정리
  useEffect(() => () => {
    const mr = mediaRef.current;
    if (mr) { mr.onstop = null; try { mr.stop(); } catch { /* noop */ } }
    stopLoop();
    runningRef.current = false;
    sttRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    displayStreamRef.current?.getTracks().forEach((t) => t.stop());
    if (audioCtxRef.current) void audioCtxRef.current.close().catch(() => {});
  }, [stopLoop]);

  return {
    state, elapsedMs, level, segments, interim, error, sttSupported,
    start, pause, resume, stop, cancel, setSpeaker,
  };
}
