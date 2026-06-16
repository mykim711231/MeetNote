import { useCallback, useEffect, useRef, useState } from 'react';
import type { Segment } from '@/types';
import { SttController, isSttSupported } from '@/lib/stt';
import { appendDraftChunk, saveDraftMeta, clearDraft } from '@/lib/db';
import { usePrefStore } from '@/stores/usePrefStore';
import { useWakeLock } from './useWakeLock';

export type RecState = 'idle' | 'recording' | 'paused';

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

  const sttSupported = isSttSupported();

  // ── 내부 ref ──
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const mimeRef = useRef('');
  const sttRef = useRef<SttController | null>(null);
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

  const start = useCallback(async (speaker: string) => {
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

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (e) {
      const name = (e as DOMException)?.name ?? '';
      setError(
        name === 'NotAllowedError'
          ? '마이크 권한이 거부되었습니다. 브라우저 설정에서 허용해 주세요.'
          : '마이크를 사용할 수 없습니다. (다른 앱이 점유 중이거나 장치 없음)'
      );
      startingRef.current = false;
      return;
    }
    streamRef.current = stream;

    // 레벨 미터
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
      if (audioCtxRef.current) { void audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
      analyserRef.current = null;
      startingRef.current = false;
      return;
    }

    // STT (지원 시)
    if (sttSupported) {
      const ctrl = new SttController({
        onFinal: pushFinal,
        onInterim: setInterim,
        onFatal: () => setInterim(''),
      }, usePrefStore.getState().sttLang);
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
    if (audioCtxRef.current) void audioCtxRef.current.close().catch(() => {});
  }, [stopLoop]);

  return {
    state, elapsedMs, level, segments, interim, error, sttSupported,
    start, pause, resume, stop, cancel, setSpeaker,
  };
}
