import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Pause, Play, Square, X, Plus, AlertTriangle, ChevronDown, Settings2 } from 'lucide-react';
import { useRecorderContext } from '@/components/RecorderProvider';
import type { RecSource } from '@/hooks/useRecorder';
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
  const { rec, title, setTitle, speakers, current, setCurrent, addSpeaker, source, setSource } = useRecorderContext();

  const { sttLang, setSttLang } = usePrefStore();
  const [adding, setAdding] = useState(false);
  const [newSpeaker, setNewSpeaker] = useState('');
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [rec.segments, rec.interim]);

  const recording = rec.state === 'recording';
  const paused = rec.state === 'paused';
  const busy = recording || paused;

  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const canSystemAudio = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia;

  useEffect(() => {
    if (!canSystemAudio && source !== 'mic') setSource('mic');
  }, [canSystemAudio, source, setSource]);

  const sourceOpts: Array<{ key: RecSource; label: string }> = canSystemAudio
    ? [{ key: 'mic', label: '마이크' }, { key: 'system', label: '시스템' }, { key: 'both', label: '둘 다' }]
    : [{ key: 'mic', label: '마이크' }];

  const currentSourceLabel = sourceOpts.find((s) => s.key === source)?.label ?? '마이크';
  const currentLangLabel = STT_LANGS.find((l) => l.code === sttLang)?.label ?? '한국어';

  const onAddSpeaker = () => {
    addSpeaker(newSpeaker);
    setNewSpeaker('');
    setAdding(false);
  };

  const onStart = async () => {
    if (starting) return;
    setStarting(true);
    try {
      await requestPersist().catch(() => false);
      await rec.start(current, source);
    } finally {
      setStarting(false);
    }
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
      {isIOS && !busy && (
        <div className="flex-none flex items-start gap-2 px-4 py-2 text-xs bg-primary/10 text-primary">
          <AlertTriangle size={14} className="flex-none mt-0.5" />
          <span>
            아이폰은 실시간 자막이 안 돼요.{' '}
            <button type="button" onClick={() => navigate('/library')} className="underline font-semibold">
              기록 → 가져오기
            </button>
            로 불러오세요.
          </span>
        </div>
      )}
      {window.isSecureContext && !rec.sttSupported && !isIOS && (
        <Banner text="이 브라우저는 실시간 자막을 지원하지 않습니다. Chrome·Edge 권장." soft />
      )}
      {rec.error && <Banner text={rec.error} />}

      {/* 제목 입력 */}
      <div className="flex-none px-5 pt-4 pb-3 border-b border-divider">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목 없는 회의"
          aria-label="회의 제목"
          className="w-full bg-transparent text-fg text-xl font-bold placeholder:text-muted/40 outline-none"
        />
      </div>

      {/* 녹음 중: 발언자 + 타이머 */}
      {busy && (
        <div className="flex-none px-4 pt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onAddSpeaker();
                  if (e.key === 'Escape') { setAdding(false); setNewSpeaker(''); }
                }}
                onBlur={onAddSpeaker}
                placeholder="이름"
                aria-label="새 발언자 이름"
                className="px-3 py-1.5 w-24 rounded-full text-sm border border-primary bg-transparent text-fg outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                aria-label="발언자 추가"
                className="px-2 py-1.5 rounded-full border border-dashed border-divider text-muted"
              >
                <Plus size={16} />
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <div className={`text-2xl font-bold tabular-nums ${recording ? 'text-accent' : 'text-fg'}`}>
                {fmtTime(rec.elapsedMs)}
              </div>
              <LevelMeter level={rec.level} active={recording} />
            </div>
          </div>
          {busy && (
            <div className="flex items-center gap-1.5 text-xs text-muted">
              {recording
                ? <><span className="w-2 h-2 rounded-full bg-accent rec-pulse" /> 녹음 중</>
                : '일시정지됨'}
            </div>
          )}
        </div>
      )}

      {/* 중앙 영역 */}
      {!busy ? (
        /* 대기 상태 — 중앙 집중 */
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6 pb-2">
          {/* 장식용 마이크 아이콘 */}
          <div className="w-28 h-28 rounded-full bg-accent/10 grid place-items-center">
            <Mic size={52} className="text-accent/50" />
          </div>

          {/* 현재 설정 표시 + 고급 토글 */}
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-surface border border-divider text-sm text-muted"
          >
            <Settings2 size={14} />
            {currentSourceLabel} · {currentLangLabel}
            <ChevronDown
              size={14}
              className={`transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`}
            />
          </button>

          {/* 고급 설정 패널 */}
          {showAdvanced && (
            <div className="w-full max-w-sm space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              {/* 소스 */}
              {canSystemAudio && (
                <div>
                  <p className="text-xs text-muted mb-1.5 font-medium">녹음 소스</p>
                  <div
                    className="grid rounded-full bg-divider/30 p-1 text-xs"
                    style={{ gridTemplateColumns: `repeat(${sourceOpts.length}, 1fr)` }}
                  >
                    {sourceOpts.map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSource(key)}
                        className={`py-2 rounded-full font-medium transition ${
                          source === key ? 'bg-surface text-primary shadow-sm' : 'text-muted'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {source !== 'mic' && (
                    <p className="text-xs text-muted mt-1.5 leading-relaxed">
                      시작 시 공유 창에서 <b>"탭/시스템 오디오 공유"</b>를 켜세요.
                    </p>
                  )}
                </div>
              )}

              {/* 언어 */}
              <div>
                <p className="text-xs text-muted mb-1.5 font-medium">자막 언어</p>
                <div
                  className="grid rounded-full bg-divider/30 p-1 text-xs"
                  style={{ gridTemplateColumns: `repeat(${STT_LANGS.length}, 1fr)` }}
                >
                  {STT_LANGS.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => setSttLang(l.code)}
                      className={`py-2 rounded-full font-medium transition ${
                        sttLang === l.code ? 'bg-surface text-primary shadow-sm' : 'text-muted'
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 발언자 (선택) */}
              <div>
                <p className="text-xs text-muted mb-1.5 font-medium">발언자 미리 추가 (선택)</p>
                <div className="flex flex-wrap items-center gap-2">
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
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onAddSpeaker();
                        if (e.key === 'Escape') { setAdding(false); setNewSpeaker(''); }
                      }}
                      onBlur={onAddSpeaker}
                      placeholder="이름"
                      className="px-3 py-1.5 w-24 rounded-full text-sm border border-primary bg-transparent text-fg outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAdding(true)}
                      aria-label="발언자 추가"
                      className="px-2 py-1.5 rounded-full border border-dashed border-divider text-muted"
                    >
                      <Plus size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* 녹음 중 — 전사 스크롤 영역 */
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-4 space-y-2">
          {rec.segments.length === 0 && !rec.interim && (
            <p className="text-center text-muted text-sm pt-8">말하면 자막이 여기에 표시됩니다…</p>
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
      )}

      {/* 컨트롤 */}
      <div className="flex-none flex items-center justify-center gap-6 py-5 border-t border-divider">
        {!busy ? (
          <button
            type="button"
            onClick={onStart}
            disabled={starting}
            aria-label="녹음 시작"
            className="w-20 h-20 rounded-full bg-accent text-white grid place-items-center shadow-lg active:scale-95 transition disabled:opacity-60"
          >
            <Mic size={34} />
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onCancel}
              aria-label="취소"
              className="w-14 h-14 rounded-full border border-divider text-muted grid place-items-center"
            >
              <X size={24} />
            </button>
            {recording ? (
              <button
                type="button"
                onClick={rec.pause}
                aria-label="일시정지"
                className="w-20 h-20 rounded-full bg-primary text-white grid place-items-center shadow-lg active:scale-95 transition"
              >
                <Pause size={32} />
              </button>
            ) : (
              <button
                type="button"
                onClick={rec.resume}
                aria-label="이어서 녹음"
                className="w-20 h-20 rounded-full bg-accent text-white grid place-items-center shadow-lg active:scale-95 transition"
              >
                <Play size={32} />
              </button>
            )}
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              aria-label="저장"
              className="w-14 h-14 rounded-full bg-primary/15 text-primary grid place-items-center disabled:opacity-50"
            >
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
