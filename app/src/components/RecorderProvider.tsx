import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRecorder, type RecSource } from '@/hooks/useRecorder';

// recorder를 App 레벨에 마운트해 탭 전환(RecordView 언마운트) 시에도
// 녹음이 유지되도록 한다. 녹음 메타(제목·발언자) 입력 상태도 함께 보존.

type RecorderApi = ReturnType<typeof useRecorder>;

interface RecorderCtx {
  rec: RecorderApi;
  title: string;
  setTitle: (v: string) => void;
  speakers: string[];
  current: string;
  setCurrent: (v: string) => void;
  addSpeaker: (name: string) => void;
  source: RecSource;
  setSource: (s: RecSource) => void;
  folderId: string | null;
  setFolderId: (id: string | null) => void;
}

const Ctx = createContext<RecorderCtx | null>(null);

export function RecorderProvider({ children }: { children: ReactNode }): JSX.Element {
  const rec = useRecorder();
  const [title, setTitle] = useState('');
  const [speakers, setSpeakers] = useState<string[]>(['나', '상대']);
  const [current, setCurrent] = useState('나');
  const [source, setSource] = useState<RecSource>('mic');
  const [folderId, setFolderId] = useState<string | null>(null);

  const { setSpeaker } = rec;
  useEffect(() => { setSpeaker(current); }, [current, setSpeaker]);

  // 녹음 중 탭 닫기/새로고침 시 경고 (크래시 복구와 병행 안전장치)
  useEffect(() => {
    if (rec.state === 'idle') return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [rec.state]);

  const addSpeaker = (name: string) => {
    const n = name.trim();
    if (n && !speakers.includes(n)) {
      setSpeakers((s) => [...s, n]);
      setCurrent(n);
    }
  };

  const value: RecorderCtx = { rec, title, setTitle, speakers, current, setCurrent, addSpeaker, source, setSource, folderId, setFolderId };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRecorderContext(): RecorderCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useRecorderContext must be used within RecorderProvider');
  return v;
}
