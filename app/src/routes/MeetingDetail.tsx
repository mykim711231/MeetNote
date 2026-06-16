import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Play, Pause, Trash2, Download, FileText, FileCode,
  FileJson, Music, Gauge, Pencil,
} from 'lucide-react';
import { getMeeting, getAudio } from '@/lib/db';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { summarize, extractTodos } from '@/lib/summarize';
import {
  downloadBlob, safeFilename, toPlainText, toMarkdown,
} from '@/lib/export';
import { toast } from '@/stores/useToastStore';
import { confirmDialog } from '@/stores/useConfirmStore';
import { fmtTime, fmtDate, fmtDuration } from '@/lib/format';
import type { MeetingMeta } from '@/types';

type DetailTab = 'transcript' | 'summary' | 'todos';
const SPEEDS = [1, 1.25, 1.5, 2, 0.75];

export default function MeetingDetail(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { folders, update, remove } = useMeetingStore();

  const [meeting, setMeeting] = useState<MeetingMeta | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>('transcript');

  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [curMs, setCurMs] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [editing, setEditing] = useState(false);

  const mid = Number(id);

  // 회의록 로드
  useEffect(() => {
    let alive = true;
    if (!Number.isFinite(mid)) { setNotFound(true); return; }
    void getMeeting(mid).then((m) => {
      if (!alive) return;
      if (!m) { setNotFound(true); return; }
      setMeeting(m);
    });
    return () => { alive = false; };
  }, [mid]);

  // 오디오 Blob 로드 → object URL
  useEffect(() => {
    if (!meeting?.hasAudio) return;
    let url: string | null = null;
    let alive = true;
    void getAudio(meeting.id).then((blob) => {
      if (!alive || !blob) return;
      url = URL.createObjectURL(blob);
      setAudioUrl(url);
    });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
      setAudioUrl(null);
    };
  }, [meeting?.id, meeting?.hasAudio]);

  // 잠금화면/데스크톱 미디어 컨트롤 (지원 브라우저만)
  useEffect(() => {
    if (!('mediaSession' in navigator) || !meeting?.hasAudio) return;
    const ms = navigator.mediaSession;
    try {
      ms.metadata = new MediaMetadata({
        title: meeting.title || '회의록',
        artist: 'MeetNote',
        album: fmtDate(meeting.date),
        artwork: [{ src: `${import.meta.env.BASE_URL}icons/icon-512.png`, sizes: '512x512', type: 'image/png' }],
      });
    } catch { /* noop */ }
    const setH = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try { ms.setActionHandler(action, handler); } catch { /* 미지원 액션 무시 */ }
    };
    const a = () => audioRef.current;
    setH('play', () => { void a()?.play(); });
    setH('pause', () => a()?.pause());
    setH('seekbackward', (d) => { const el = a(); if (el) el.currentTime = Math.max(0, el.currentTime - (d.seekOffset ?? 10)); });
    setH('seekforward', (d) => { const el = a(); if (el) { const t = el.currentTime + (d.seekOffset ?? 10); el.currentTime = Number.isFinite(el.duration) ? Math.min(el.duration, t) : t; } });
    setH('seekto', (d) => { const el = a(); if (el && d.seekTime != null) el.currentTime = d.seekTime; });
    return () => {
      (['play', 'pause', 'seekbackward', 'seekforward', 'seekto'] as MediaSessionAction[]).forEach((act) => setH(act, null));
    };
  }, [meeting?.id, meeting?.hasAudio, meeting?.title, meeting?.date]);

  const summary = useMemo(() => (meeting ? summarize(meeting.segments) : []), [meeting]);
  const todos = useMemo(() => (meeting ? extractTodos(meeting.segments) : []), [meeting]);

  // 현재 재생 위치에 해당하는 세그먼트 index
  const activeIdx = useMemo(() => {
    if (!meeting) return -1;
    let idx = -1;
    for (let i = 0; i < meeting.segments.length; i++) {
      if (meeting.segments[i].ts <= curMs + 250) idx = i;
      else break;
    }
    return idx;
  }, [meeting, curMs]);

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted">
        <p>회의록을 찾을 수 없습니다.</p>
        <button type="button" onClick={() => navigate('/library')} className="text-primary font-medium">기록으로</button>
      </div>
    );
  }
  if (!meeting) {
    return <div className="grid place-items-center h-full text-muted text-sm">불러오는 중…</div>;
  }

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) void a.play(); else a.pause();
  };

  const seekTo = (ms: number) => {
    const a = audioRef.current;
    if (!a || !audioUrl) return; // 오디오 로드 전 play() 호출로 인한 uncaught rejection 방지
    a.currentTime = ms / 1000;
    setCurMs(ms);
    void a.play();
  };

  const cycleSpeed = () => {
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    if (audioRef.current) audioRef.current.playbackRate = SPEEDS[next];
  };

  const onRename = async (title: string) => {
    const next = { ...meeting, title: title.trim() || meeting.title };
    setMeeting(next);
    await update(next);
  };

  const onFolder = async (folderId: string | null) => {
    const next = { ...meeting, folderId };
    setMeeting(next);
    await update(next);
  };

  const patchSegment = async (i: number, patch: Partial<{ text: string; who: string }>) => {
    const segments = meeting.segments.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    const next = { ...meeting, segments };
    setMeeting(next);
    await update(next);
  };

  const deleteSegment = async (i: number) => {
    const next = { ...meeting, segments: meeting.segments.filter((_, idx) => idx !== i) };
    setMeeting(next);
    await update(next);
  };

  const onDelete = async () => {
    const ok = await confirmDialog({ message: '이 회의록을 삭제할까요?\n되돌릴 수 없습니다.', confirmLabel: '삭제', danger: true });
    if (!ok) return;
    await remove(meeting.id);
    toast('삭제되었습니다.');
    navigate('/library');
  };

  const exportTxt = () => downloadBlob(new Blob([toPlainText(meeting)], { type: 'text/plain;charset=utf-8' }), `${safeFilename(meeting.title)}.txt`);
  const exportMd = () => downloadBlob(new Blob([toMarkdown(meeting)], { type: 'text/markdown;charset=utf-8' }), `${safeFilename(meeting.title)}.md`);
  const exportJson = () => downloadBlob(new Blob([JSON.stringify(meeting, null, 2)], { type: 'application/json' }), `${safeFilename(meeting.title)}.json`);
  const exportAudio = async () => {
    const blob = await getAudio(meeting.id);
    if (!blob) { toast('오디오가 없습니다.', 'error'); return; }
    const ext = (meeting.audioType.includes('mp4') ? 'm4a' : meeting.audioType.includes('ogg') ? 'ogg' : 'webm');
    downloadBlob(blob, `${safeFilename(meeting.title)}.${ext}`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex-none flex items-center gap-2 px-2 h-12 border-b border-divider">
        <button type="button" onClick={() => navigate(-1)} aria-label="뒤로" className="w-10 h-10 grid place-items-center text-muted">
          <ArrowLeft size={20} />
        </button>
        <input
          key={meeting.id}
          defaultValue={meeting.title}
          onBlur={(e) => { void onRename(e.target.value); }}
          aria-label="회의 제목"
          className="flex-1 bg-transparent text-fg font-semibold outline-none"
        />
        <button type="button" onClick={onDelete} aria-label="삭제" className="w-10 h-10 grid place-items-center text-accent">
          <Trash2 size={18} />
        </button>
      </div>

      {/* 메타 + 폴더 */}
      <div className="flex-none px-4 pt-2 flex items-center justify-between gap-2">
        <span className="text-xs text-muted">{fmtDate(meeting.date)} · {fmtDuration(meeting.duration)}</span>
        <select
          value={meeting.folderId ?? ''}
          onChange={(e) => onFolder(e.target.value || null)}
          aria-label="폴더 선택"
          className="text-xs bg-surface border border-divider rounded-full px-2 py-1 text-muted outline-none"
        >
          <option value="">미분류</option>
          {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>

      {/* 오디오 플레이어 */}
      {meeting.hasAudio ? (
        <div className="flex-none mx-4 mt-3 rounded-2xl bg-surface border border-divider p-3 flex items-center gap-3">
          <button type="button" onClick={togglePlay} aria-label={playing ? '일시정지' : '재생'} className="w-12 h-12 rounded-full bg-primary text-white grid place-items-center flex-none">
            {playing ? <Pause size={22} /> : <Play size={22} />}
          </button>
          <div className="flex-1 min-w-0">
            <input
              type="range"
              min={0}
              max={Math.max(1, meeting.duration)}
              value={Math.min(curMs, meeting.duration)}
              onChange={(e) => seekTo(Number(e.target.value))}
              className="w-full accent-primary"
              aria-label="재생 위치"
            />
            <div className="flex justify-between text-xs text-muted tabular-nums">
              <span>{fmtTime(curMs)}</span>
              <span>{fmtTime(meeting.duration)}</span>
            </div>
          </div>
          <button type="button" onClick={cycleSpeed} aria-label={`재생 속도 ${SPEEDS[speedIdx]}배, 눌러서 변경`} className="flex-none flex items-center gap-1 text-xs font-bold text-primary px-2 py-1 rounded-full bg-primary/10">
            <Gauge size={14} /> {SPEEDS[speedIdx]}×
          </button>
          <audio
            ref={audioRef}
            src={audioUrl ?? undefined}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onTimeUpdate={(e) => setCurMs(e.currentTarget.currentTime * 1000)}
            preload="metadata"
          />
        </div>
      ) : (
        <div className="flex-none mx-4 mt-3 rounded-2xl bg-surface border border-divider p-3 text-xs text-muted text-center">
          오디오 없이 자막만 저장된 회의록입니다.
        </div>
      )}

      {/* 탭 */}
      <div className="flex-none px-4 pt-3">
        <div className="grid grid-cols-3 rounded-full bg-divider/30 p-1 text-sm">
          {([['transcript', '전문'], ['summary', '요약'], ['todos', `할 일${todos.length ? ` ${todos.length}` : ''}`]] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`py-1.5 rounded-full font-medium ${tab === key ? 'bg-surface text-primary shadow-sm' : 'text-muted'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2">
        {tab === 'transcript' && (
          meeting.segments.length === 0 ? (
            <p className="text-center text-muted text-sm pt-8">전사된 내용이 없습니다.</p>
          ) : (
            <>
              <div className="flex justify-end -mt-1">
                <button type="button" onClick={() => setEditing((v) => !v)} className="flex items-center gap-1 text-xs font-medium text-primary px-2 py-1">
                  <Pencil size={13} /> {editing ? '완료' : '편집'}
                </button>
              </div>
              {meeting.segments.map((s, i) => (
                editing ? (
                  <div key={i} className="rounded-xl border border-divider px-3 py-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <input
                        defaultValue={s.who}
                        onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== s.who) void patchSegment(i, { who: v }); }}
                        aria-label="발언자"
                        className="w-24 bg-transparent text-primary font-semibold text-sm border-b border-divider outline-none"
                      />
                      <span className="text-muted text-xs tabular-nums flex-1">[{fmtTime(s.ts)}]</span>
                      <button type="button" onClick={() => void deleteSegment(i)} aria-label="이 발언 삭제" className="text-accent p-1"><Trash2 size={14} /></button>
                    </div>
                    <textarea
                      defaultValue={s.text}
                      onBlur={(e) => { const v = e.target.value.trim(); if (v !== s.text) void patchSegment(i, { text: v }); }}
                      aria-label="발언 내용"
                      rows={2}
                      className="w-full bg-transparent text-fg text-sm outline-none resize-y"
                    />
                  </div>
                ) : (
                  <button
                    key={i}
                    type="button"
                    onClick={() => meeting.hasAudio && seekTo(s.ts)}
                    className={`w-full text-left rounded-xl px-3 py-2 transition ${i === activeIdx ? 'bg-primary/10' : ''} ${meeting.hasAudio ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <span className="text-primary font-semibold text-sm">{s.who} </span>
                    <span className="text-muted text-xs tabular-nums">[{fmtTime(s.ts)}]</span>
                    <div className="text-fg text-sm mt-0.5">{s.text}</div>
                  </button>
                )
              ))}
            </>
          )
        )}

        {tab === 'summary' && (
          summary.length === 0
            ? <p className="text-center text-muted text-sm pt-8">요약할 내용이 부족합니다.</p>
            : <ul className="space-y-2">
                {summary.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm text-fg">
                    <span className="text-primary font-bold flex-none">{i + 1}.</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
        )}

        {tab === 'todos' && (
          todos.length === 0
            ? <p className="text-center text-muted text-sm pt-8">추출된 할 일이 없습니다.</p>
            : <ul className="space-y-2">
                {todos.map((t, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="flex-none w-4 h-4 mt-0.5 rounded border border-primary" />
                    <button type="button" onClick={() => meeting.hasAudio && seekTo(t.ts)} className="text-left text-fg">
                      {t.text} <span className="text-muted text-xs">({t.who})</span>
                    </button>
                  </li>
                ))}
              </ul>
        )}
      </div>

      {/* 내보내기 */}
      <div className="flex-none border-t border-divider px-3 py-2 flex items-center gap-1 overflow-x-auto">
        <span className="flex items-center gap-1 text-xs text-muted px-1 flex-none"><Download size={14} /> 내보내기</span>
        <ExportBtn onClick={exportTxt} Icon={FileText} label="TXT" />
        <ExportBtn onClick={exportMd} Icon={FileCode} label="MD" />
        <ExportBtn onClick={exportJson} Icon={FileJson} label="JSON" />
        {meeting.hasAudio && <ExportBtn onClick={exportAudio} Icon={Music} label="오디오" />}
      </div>
    </div>
  );
}

function ExportBtn({ onClick, Icon, label }: { onClick: () => void; Icon: typeof FileText; label: string }): JSX.Element {
  return (
    <button type="button" onClick={onClick} className="flex-none flex items-center gap-1 text-xs font-medium text-fg border border-divider rounded-full px-3 py-1.5">
      <Icon size={14} /> {label}
    </button>
  );
}
