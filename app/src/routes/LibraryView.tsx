import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Mic, ChevronRight, FolderOpen, Pin, Upload, FileText, List, CalendarDays } from 'lucide-react';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { fmtDate, fmtDuration } from '@/lib/format';
import { getAudioDuration, guessAudioType, fileTitle } from '@/lib/audioFile';
import { requestPersist } from '@/lib/db';
import { toast } from '@/stores/useToastStore';
import MonthCalendar, { dayKey } from '@/components/MonthCalendar';
import type { MeetingMeta } from '@/types';

type Sort = 'recent' | 'oldest' | 'longest';
type ViewMode = 'list' | 'calendar';

function Highlight({ text, q }: { text: string; q: string }): JSX.Element {
  if (!q) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/25 text-fg rounded px-0.5">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

function snippet(m: MeetingMeta, q: string): string {
  const text = m.segments.map((s) => s.text).join(' ');
  if (!text) return '';
  if (q) {
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i > 40) return '…' + text.slice(i - 30, i + 50);
  }
  return text.slice(0, 80);
}

export default function LibraryView(): JSX.Element {
  const navigate = useNavigate();
  const { meetings, folders, loaded, load, saveNew } = useMeetingStore();
  const [q, setQ] = useState('');
  const [folderId, setFolderId] = useState<string | 'all'>('all');
  const [sort, setSort] = useState<Sort>('recent');
  const [mode, setMode] = useState<ViewMode>('list');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!loaded) void load(); }, [loaded, load]);

  const onImport = async (file: File) => {
    if (!file.type.startsWith('audio') && !/\.(mp3|m4a|aac|wav|ogg|opus|webm|flac|amr|3gp|mp4)$/i.test(file.name)) {
      toast('오디오 파일만 가져올 수 있어요.', 'error');
      return;
    }
    setImporting(true);
    try {
      await requestPersist().catch(() => false);
      const audioType = guessAudioType(file);
      const blob = file.type ? file : new Blob([file], { type: audioType });
      const duration = await getAudioDuration(blob);
      const meta: MeetingMeta = {
        id: Date.now(),
        title: fileTitle(file),
        date: new Date(file.lastModified || Date.now()).toISOString(),
        duration,
        segments: [],
        folderId: folderId === 'all' ? null : folderId,
        hasAudio: true,
        audioType,
      };
      await saveNew(meta, blob);
      toast('파일을 가져왔어요.', 'success');
      navigate(`/m/${meta.id}`);
    } catch {
      toast('가져오기 실패 — 저장 공간이 부족할 수 있어요.', 'error');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onNewNote = async () => {
    const meta: MeetingMeta = {
      id: Date.now(),
      title: '새 노트',
      date: new Date().toISOString(),
      duration: 0,
      segments: [],
      folderId: folderId === 'all' ? null : folderId,
      hasAudio: false,
      audioType: '',
    };
    try {
      await saveNew(meta, null);
      navigate(`/m/${meta.id}`);
    } catch {
      toast('새 노트를 만들지 못했어요.', 'error');
    }
  };

  const needle = q.trim();

  const filtered = useMemo(() => {
    const n = needle.toLowerCase();
    const list = meetings.filter((m) => {
      if (folderId !== 'all' && m.folderId !== folderId) return false;
      if (selectedDay) {
        const d = new Date(m.date);
        if (Number.isNaN(d.getTime()) || dayKey(d) !== selectedDay) return false;
      }
      if (!n) return true;
      if (m.title.toLowerCase().includes(n)) return true;
      return m.segments.some((s) => s.text.toLowerCase().includes(n));
    });
    const sorted = [...list];
    if (sort === 'oldest') sorted.reverse();
    else if (sort === 'longest') sorted.sort((a, b) => b.duration - a.duration);
    sorted.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    return sorted;
  }, [meetings, needle, folderId, sort, selectedDay]);

  return (
    <div className="flex flex-col h-full">
      {/* 빠른 액션 */}
      <div className="flex-none px-4 pt-3 grid grid-cols-3 gap-2">
        <QuickAction Icon={Mic} label="녹음" onClick={() => navigate('/')} />
        <QuickAction Icon={Upload} label="파일 업로드" onClick={() => fileRef.current?.click()} disabled={importing} />
        <QuickAction Icon={FileText} label="새 노트" onClick={() => void onNewNote()} />
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void onImport(f); }}
      />

      {/* 검색 + 보기 전환 */}
      <div className="flex-none px-4 pt-3 flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-full bg-surface border border-divider px-3 py-2 flex-1">
          <Search size={18} className="text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="제목·내용 검색"
            aria-label="제목 또는 내용 검색"
            className="flex-1 bg-transparent outline-none text-sm text-fg placeholder:text-muted/60"
          />
        </div>
        <button
          type="button"
          onClick={() => { setMode((v) => (v === 'list' ? 'calendar' : 'list')); }}
          aria-label={mode === 'list' ? '달력 보기' : '목록 보기'}
          className="flex-none w-10 h-10 grid place-items-center rounded-full bg-surface border border-divider text-muted"
        >
          {mode === 'list' ? <CalendarDays size={18} /> : <List size={18} />}
        </button>
      </div>

      {/* 폴더 필터 + 정렬 */}
      {(folders.length > 0 || mode === 'list') && (
        <div className="flex-none px-4 pt-3 flex items-center gap-2">
          <div className="flex gap-2 overflow-x-auto flex-1">
            {folders.length > 0 && <Chip active={folderId === 'all'} onClick={() => setFolderId('all')} label="전체" />}
            {folders.map((f) => (
              <Chip key={f.id} active={folderId === f.id} onClick={() => setFolderId(f.id)} label={f.name} />
            ))}
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            aria-label="정렬 기준"
            className="flex-none text-xs bg-surface border border-divider rounded-full px-2 py-1.5 text-muted outline-none"
          >
            <option value="recent">최신순</option>
            <option value="oldest">오래된순</option>
            <option value="longest">긴 길이순</option>
          </select>
        </div>
      )}

      {/* 달력 */}
      {mode === 'calendar' && (
        <div className="flex-none px-4 pt-3">
          <MonthCalendar meetings={meetings} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
          <div className="text-xs text-muted pt-2">
            {selectedDay ? `${selectedDay} · ${filtered.length}건` : '날짜를 선택하면 그날 회의록만 봐요.'}
          </div>
        </div>
      )}

      {/* 결과 개수 (목록 모드) */}
      {mode === 'list' && loaded && meetings.length > 0 && (
        <div className="flex-none px-4 pt-2 text-xs text-muted">{filtered.length}건</div>
      )}

      {/* 목록 */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2 space-y-2">
        {!loaded ? (
          <p className="text-center text-muted text-sm pt-10">불러오는 중…</p>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-12 text-muted gap-3">
            {meetings.length === 0 ? (
              <>
                <Mic size={40} className="opacity-40" />
                <p className="text-sm">아직 저장된 회의록이 없습니다.</p>
                <p className="text-xs">위에서 <span className="text-primary font-semibold">녹음</span>·<span className="text-primary font-semibold">파일 업로드</span>·<span className="text-primary font-semibold">새 노트</span>로 시작하세요.</p>
              </>
            ) : (
              <>
                <FolderOpen size={40} className="opacity-40" />
                <p className="text-sm">{selectedDay ? '이 날짜의 회의록이 없어요.' : '검색 결과가 없습니다.'}</p>
              </>
            )}
          </div>
        ) : (
          filtered.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => navigate(`/m/${m.id}`)}
              className="w-full text-left flex items-center gap-3 rounded-2xl bg-surface border border-divider px-4 py-3 active:scale-[0.99] transition"
            >
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-fg truncate flex items-center gap-1">
                  {m.pinned && <Pin size={13} className="text-primary flex-none" fill="currentColor" />}
                  <span className="truncate"><Highlight text={m.title} q={needle} /></span>
                </div>
                <div className="text-xs text-muted mt-0.5">
                  {fmtDate(m.date)}{m.hasAudio ? ` · ${fmtDuration(m.duration)}` : ' · 노트'}
                </div>
                {snippet(m, needle) && (
                  <div className="text-xs text-muted mt-1 truncate"><Highlight text={snippet(m, needle)} q={needle} /></div>
                )}
              </div>
              <ChevronRight size={18} className="text-muted flex-none" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function QuickAction({ Icon, label, onClick, disabled }: { Icon: typeof Mic; label: string; onClick: () => void; disabled?: boolean }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-surface border border-divider py-3 active:scale-[0.98] transition disabled:opacity-50"
    >
      <Icon size={22} className="text-primary" />
      <span className="text-xs font-medium text-fg">{label}</span>
    </button>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-none px-3 py-1.5 rounded-full text-sm font-medium border ${
        active ? 'bg-primary text-white border-primary' : 'border-divider text-muted'
      }`}
    >
      {label}
    </button>
  );
}
