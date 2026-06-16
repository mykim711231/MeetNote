import { useCallback, useEffect, useRef } from 'react';

// 화면 꺼짐 방지 (녹음 중 모바일 화면이 잠겨 녹음이 끊기는 것 방지)
// 지원하지 않는 브라우저에서는 조용히 무시된다.

interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: 'release', cb: () => void) => void;
}

export function useWakeLock(): { acquire: () => Promise<void>; release: () => void } {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const wantedRef = useRef(false);

  const acquire = useCallback(async () => {
    wantedRef.current = true;
    const wl = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinelLike> } }).wakeLock;
    if (!wl) return;
    try {
      const sentinel = await wl.request('screen');
      sentinelRef.current = sentinel;
      sentinel.addEventListener('release', () => {
        sentinelRef.current = null;
      });
    } catch {
      // 사용자 제스처 없음·미지원 → 무시
    }
  }, []);

  const release = useCallback(() => {
    wantedRef.current = false;
    const s = sentinelRef.current;
    sentinelRef.current = null;
    if (s && !s.released) void s.release().catch(() => {});
  }, []);

  // 탭이 다시 보이면 (화면 복귀) 재획득
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && wantedRef.current && !sentinelRef.current) {
        void acquire();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [acquire]);

  // 언마운트 시 해제
  useEffect(() => () => release(), [release]);

  return { acquire, release };
}
