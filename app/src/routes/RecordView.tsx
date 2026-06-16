import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Pause, Play, Square, X, Plus, AlertTriangle } from 'lucide-react';
import { useRecorderContext } from '@/components/RecorderProvider';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { usePrefStore, STT_LANGS } from '@/stores/usePrefStore';
import { requestPersist, clearDraft } from '@/lib/db';
import { toast } from '@/stores/useToastStore';
import { confirmDialog } from '@/stores/useConfirmStore';
import { fmtTime } from '@/lib/format';
import { speakerColor } from '@/lib/speakers';
import type { MeetingMeta } from '@/types';
import LevelMeter from '@/components/LevelMeter';

export default function RecordView(): JSX.Element {
  const navigate = useNavigate();
  const saveNew = useMeetingStore((s) => s.saveNew);
  const { rec, title, setTitle, speakers, current, setCurrent, addSpeaker } = useRecorderContext();

  const { sttLang, setSttLang } = usePrefStore();
  const [adding, setAdding] = useState(false);
  const [newSpeaker, setNewSpeaker] = useState('');
  const [saving, setSaving] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // 전사 자동 스크롤
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [rec.segments, rec.interim]);

  const recording = rec.state === 'recording';
  const paused = rec.state === 'paused';
  const busy = recording || paused;

  const onAddSpeaker = () => {
    addSpeaker(newSpeaker);
    setNewSpeaker('');
    setAdding(false);
  };

  const onStart = async () => {
    await requestPersist().catch(() => false);
    await rec.start(current);
  };

  const onSave = async () => {
    setSaving(true);
    const result = await rec.stop();
    setSaving(false);
    if (!result || (!result.blob && result.segments.length === 0)) {
      toast('녹음된 내용이 없습니다.', 'error');
      return;
    }
    const meta: MeetingMeta = {
      id: Date.now(),
      title: title.trim() || `회의 ${fmtTime(result.duration)}`,
      date: new Date().toISOString(),
      duration: result.duration,
      segments: result.segments,
      folderId: null,
      hasAudio: !!result.blob,
      audioType: result.audioType,
    };
    try {
      await saveNew(meta, result.blob);
      await clearDraft().catch(() => {});
      toast('저장되었습니다.', 'success');
      setTitle('');
      navigate(`/m/${meta.id}`);
    } catch {
      toast('저장 실패 — 저장 공간이 부족할 수 있어요.', 'error');
    }
  };

  const onCancel = async () => {
    if (rec.segments.length > 0 || rec.elapsedMs > 2000) {
      const ok = await confirmDialog({ message: '녹음을 취소하고 버릴까요?', confirmLabel: '버리기', danger: true });
      if (!ok) return;
    }
    rec.cancel();
    toast('녹음을 취소했습니다.');
  };

  return (
    <div className="flex flex-col h-full">
      {/* 경고 배너 */}
      {!window.isSecureContext && <Banner text="HTTPS(또는 localhost)에서만 녹음할 수 있습니다." />}
      {window.isSecureContext && !rec.sttSupported && (
        <Banner text="이 브라우저는 실시간 자막을 지원하지 않습니다(녹음·재생은 정상). Chrome·Edge 권장." soft />
      )}
      {rec.error && <Banner text={rec.error} />}

      {/* 제목 입력 + 자막 언어 */}
      <div className="flex-none px-4 pt-3 flex items-center gap-2 border-b border-divider pb-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="회의 제목 (선택)"
          aria-label="회의 제목"
          className="flex-1 bg-transparent text-fg text-lg font-semibold placeholder:text-muted/60 outline-none"
        />
        <select
          value={sttLang}
          onChange={(e) => setSttLang(e.target.value)}
          disabled={busy}
          aria-label="자막 언어"
          className="flex-none text-xs bg-surface border border-divider rounded-full px-2 py-1.5 text-muted outline-none disabled:opacity-50"
        >
          {STT_LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
      </div>

      {/* 발언자 선택 */}
      <div className="flex-none px-4 pt-3 flex flex-wrap items-center gap-2">
        {speakers.map((sp) => (
          <button
            key={sp}
            type="button"
            onClick={() => setCurrent(sp)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
              current === sp ? 'bg-primary text-white border-primary' : 'border-divider text-muted'
            }`}
          >
            {sp}
          </button>
        ))}
        {adding ? (
          <input
            autoFocus
            value={newSpeaker}
            onChange={(e) => setNewSpeaker(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onAddSpeaker(); if (e.key === 'Escape') { setAdding(false); setNewSpeaker(''); } }}
            onBlur={onAddSpeaker}
            placeholder="이름"
            aria-label="새 발언자 이름"
            className="px-3 py-1.5 w-24 rounded-full text-sm border border-primary bg-transparent text-fg outline-none"
          />
        ) : (
          <button type="button" onClick={() => setAdding(true)} aria-label="발언자 추가" className="px-2 py-1.5 rounded-full border border-dashed border-divider text-muted">
            <Plus size={16} />
          </button>
        )}
      </div>

      {/* 타이머 + 레벨 */}
      <div className="flex-none flex flex-col items-center gap-2 py-5">
        <div className={`text-5xl font-bold tabular-nums ${recording ? 'text-accent' : 'text-fg'}`}>
          {fmtTime(rec.elapsedMs)}
        </div>
        <LevelMeter level={rec.level} active={recording} />
        {busy && (
          <div className="flex items-center gap-1.5 text-xs text-muted">
            {recording ? <><span className="w-2 h-2 rounded-full bg-accent rec-pulse" /> 녹음 중 · {current}</> : '일시정지됨'}
          </div>
        )}
      </div>

      {/* 전사 영역 */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-2">
        {rec.segments.length === 0 && !rec.interim && (
          <p className="text-center text-muted text-sm pt-8">
            {busy ? '말하면 자막이 여기에 표시됩니다…' : '아래 버튼을 눌러 녹음을 시작하세요.'}
          </p>
        )}
        {rec.segments.map((s, i) => (
          <div key={i} className="text-sm">
            <span className="font-semibold" style={{ color: speakerColor(s.who) }}>{s.who} </span>
            <span className="text-muted text-xs tabular-nums">[{fmtTime(s.ts)}]</span>
            <span className="text-fg"> {s.text}</span>
          </div>
        ))}
        {rec.interim && <p className="text-sm text-muted italic">{rec.interim}…</p>}
      </div>

      {/* 컨트롤 */}
      <div className="flex-none flex items-center justify-center gap-6 py-4 border-t border-divider">
        {!busy ? (
          <button type="button" onClick={onStart} aria-label="녹음 시작" className="w-20 h-20 rounded-full bg-accent text-white grid place-items-center shadow-lg active:scale-95 transition">
            <Mic size={34} />
          </button>
        ) : (
          <>
            <button type="button" onClick={onCancel} aria-label="취소" className="w-14 h-14 rounded-full border border-divider text-muted grid place-items-center">
              <X size={24} />
            </button>
            {recording ? (
              <button type="button" onClick={rec.pause} aria-label="일시정지" className="w-20 h-20 rounded-full bg-primary text-white grid place-items-center shadow-lg active:scale-95 transition">
                <Pause size={32} />
              </button>
            ) : (
              <button type="button" onClick={rec.resume} aria-label="이어서 녹음" className="w-20 h-20 rounded-full bg-accent text-white grid place-items-center shadow-lg active:scale-95 transition">
                <Play size={32} />
              </button>
            )}
            <button type="button" onClick={onSave} disabled={saving} aria-label="저장" className="w-14 h-14 rounded-full bg-primary/15 text-primary grid place-items-center disabled:opacity-50">
              <Square size={22} fill="currentColor" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Banner({ text, soft }: { text: string; soft?: boolean }): JSX.Element {
  return (
    <div className={`flex-none flex items-start gap-2 px-4 py-2 text-xs ${soft ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'}`}>
      <AlertTriangle size={14} className="flex-none mt-0.5" />
      <span>{text}</span>
    </div>
  );
}
