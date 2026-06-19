import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search, Mic, ChevronRight, FolderOpen, Pin, Upload, FileText, List, CalendarDays,
  Folder, BookOpen, ChevronLeft, Plus, Trash2, ArrowUp, ArrowDown, GripVertical,
  Settings2,
} from 'lucide-react';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { fmtDate, fmtDuration } from '@/lib/format';
import { getAudioDuration, guessAudioType, fileTitle } from '@/lib/audioFile';
import { requestPersist } from '@/lib/db';
import { toast } from '@/stores/useToastStore';
import MonthCalendar, { dayKey } from '@/components/MonthCalendar';
import {
  NOTE_TEMPLATES, loadTemplateOrder, saveTemplateOrder, type NoteTemplate,
} from '@/lib/noteTemplates';
import type { MeetingMeta } from '@/types';

type Sort = 'recent' | 'oldest' | 'longest';
type ViewMode = 'list' | 'calendar';
// 'folders' = 폴더 목록 화면, 'all' = 전체 노트, string = 특정 폴더 ID
type FolderView = 'folders' | 'all' | string;

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
  const { search } = useLocation();
  const { meetings, folders, loaded, load, saveNew, addFolder, removeFolder, setFolders } = useMeetingStore();

  const [folderView, setFolderView] = useState<FolderView>('folders');
  const [newFolderName, setNewFolderName] = useState('');
  const [addingFolder, setAddingFolder] = useState(false);
  const [editingFolders, setEditingFolders] = useState(false);
  const newFolderRef = useRef<HTMLInputElement>(null);

  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  const [mode, setMode] = useState<ViewMode>('list');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const [showTpl, setShowTpl] = useState(false);
  const [orderedTpls, setOrderedTpls] = useState<NoteTemplate[]>(() => loadTemplateOrder());
  const [editingTpls, setEditingTpls] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!loaded) void load(); }, [loaded, load]);
  useEffect(() => {
    if (addingFolder) requestAnimationFrame(() => newFolderRef.current?.focus());
  }, [addingFolder]);

  // 새 템플릿이 추가되면 목록 갱신 (NOTE_TEMPLATES 변경 시)
  useEffect(() => { setOrderedTpls(loadTemplateOrder()); }, []);

  // Web Share Target: 서비스워커가 /share-target POST를 받아 Cache에 저장 → ?share=1로 리다이렉트
  useEffect(() => {
    if (!search.includes('share')) return;
    const run = async () => {
      try {
        const cache = await caches.open('meetnote-share-v1');
        const response = await cache.match('pending');
        if (!response) return;
        await cache.delete('pending');
        const blob = await response.blob();
        const name = decodeURIComponent(response.headers.get('X-Filename') || 'recording.m4a');
        const file = new File([blob], name, { type: blob.type || 'audio/mp4' });
        await onImport(file);
      } catch {
        toast('공유 파일 가져오기에 실패했어요.', 'error');
      }
      navigate('/library', { replace: true });
    };
    void run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

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
        folderId: (folderView === 'all' || folderView === 'folders') ? null : folderView,
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

  const onNewNote = async (tpl: NoteTemplate) => {
    setShowTpl(false);
    const meta: MeetingMeta = {
      id: Date.now(),
      title: tpl.title,
      date: new Date().toISOString(),
      duration: 0,
      segments: [],
      folderId: (folderView === 'all' || folderView === 'folders') ? null : folderView,
      hasAudio: false,
      audioType: '',
      note: tpl.body || undefined,
    };
    try {
      await saveNew(meta, null);
      navigate(`/m/${meta.id}`);
    } catch {
      toast('새 노트를 만들지 못했어요.', 'error');
    }
  };

  const onAddFolder = () => {
    const name = newFolderName.trim();
    if (name) addFolder(name);
    setNewFolderName('');
    setAddingFolder(false);
  };

  const moveFolder = (idx: number, dir: -1 | 1) => {
    const next = [...folders];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setFolders(next);
  };

  const onDeleteFolder = async (id: string) => {
    const count = meetings.filter((m) => m.folderId === id).length;
    if (count > 0 && !window.confirm(`이 폴더의 노트 ${count}개가 '미분류'로 이동됩니다. 계속할까요?`)) return;
    await removeFolder(id);
    if (folderView === id) setFolderView('folders');
  };

  // 템플릿 순서 변경
  const moveTpl = (idx: number, dir: -1 | 1) => {
    const next = [...orderedTpls];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setOrderedTpls(next);
    saveTemplateOrder(next);
  };

  const needle = q.trim();
  const activeFolderId: string | null | undefined =
    folderView === 'folders' ? undefined
    : folderView === 'all' ? null
    : folderView;

  const filtered = useMemo(() => {
    if (activeFolderId === undefined) return [];
    const n = needle.toLowerCase();
    const list = meetings.filter((m) => {
      if (activeFolderId !== null && m.folderId !== activeFolderId) return false;
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
  }, [meetings, needle, activeFolderId, sort, selectedDay]);

  const currentFolderName =
    folderView === 'all' ? '모든 노트'
    : folders.find((f) => f.id === folderView)?.name ?? '';

  // ─── 폴더 목록 화면 ────────────────────────────────────────────────────────
  if (folderView === 'folders') {
    const totalCount = meetings.length;
    return (
      <div className="flex flex-col h-full">
        <div className="flex-none px-4 pt-4 pb-2 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-fg">폴더</h2>
          {folders.length > 1 && (
            <button
              type="button"
              onClick={() => setEditingFolders((v) => !v)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${
                editingFolders ? 'bg-primary text-white border-primary' : 'border-divider text-primary'
              }`}
            >
              {editingFolders ? '완료' : '순서 편집'}
            </button>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* 모든 노트 */}
          <button
            type="button"
            onClick={() => setFolderView('all')}
            className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-divider active:bg-divider/30 transition"
          >
            <div className="w-11 h-11 rounded-2xl bg-primary/10 grid place-items-center flex-none">
              <BookOpen size={22} className="text-primary" />
            </div>
            <span className="flex-1 text-left font-semibold text-fg">모든 노트</span>
            <span className="text-muted text-sm">{totalCount}</span>
            <ChevronRight size={16} className="text-muted flex-none" />
          </button>

          {/* 폴더 목록 */}
          {folders.map((f, idx) => {
            const count = meetings.filter((m) => m.folderId === f.id).length;
            return (
              <div key={f.id} className="flex items-center border-b border-divider">
                <button
                  type="button"
                  onClick={() => { if (!editingFolders) setFolderView(f.id); }}
                  className="flex-1 flex items-center gap-3 px-4 py-3.5 active:bg-divider/30 transition"
                >
                  <div className="w-11 h-11 rounded-2xl bg-surface border border-divider grid place-items-center flex-none">
                    <Folder size={22} className="text-muted" />
                  </div>
                  <span className="flex-1 text-left font-semibold text-fg">{f.name}</span>
                  {!editingFolders && <span className="text-muted text-sm">{count}</span>}
                  {!editingFolders && <ChevronRight size={16} className="text-muted flex-none" />}
                </button>
                {editingFolders ? (
                  <div className="flex flex-col pr-2">
                    <button
                      type="button"
                      aria-label="위로"
                      onClick={() => moveFolder(idx, -1)}
                      disabled={idx === 0}
                      className="p-1.5 text-muted disabled:opacity-25"
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label="아래로"
                      onClick={() => moveFolder(idx, 1)}
                      disabled={idx === folders.length - 1}
                      className="p-1.5 text-muted disabled:opacity-25"
                    >
                      <ArrowDown size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    aria-label={`${f.name} 폴더 삭제`}
                    onClick={() => void onDeleteFolder(f.id)}
                    className="px-4 py-3.5 text-accent active:opacity-60"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            );
          })}

          {/* 새 폴더 */}
          {addingFolder ? (
            <form
              className="flex items-center gap-2 px-4 py-3 border-b border-divider"
              onSubmit={(e) => { e.preventDefault(); onAddFolder(); }}
            >
              <div className="w-11 h-11 rounded-2xl border-2 border-dashed border-primary/40 grid place-items-center flex-none">
                <Plus size={20} className="text-primary" />
              </div>
              <input
                ref={newFolderRef}
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="폴더 이름"
                onBlur={onAddFolder}
                onKeyDown={(e) => { if (e.key === 'Escape') { setAddingFolder(false); setNewFolderName(''); } }}
                className="flex-1 bg-transparent border-b border-primary text-fg outline-none py-0.5"
              />
              <button type="submit" className="text-primary font-semibold text-sm px-1">추가</button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAddingFolder(true)}
              className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-divider/30 transition"
            >
              <div className="w-11 h-11 rounded-2xl border-2 border-dashed border-divider grid place-items-center flex-none">
                <Plus size={20} className="text-muted" />
              </div>
              <span className="text-muted font-medium">새 폴더</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── 노트 목록 화면 ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* 뒤로 + 폴더명 */}
      <div className="flex-none flex items-center gap-1 px-2 pt-2">
        <button
          type="button"
          onClick={() => { setFolderView('folders'); setQ(''); setSelectedDay(null); }}
          className="flex items-center gap-0.5 text-primary font-medium text-sm px-2 py-1.5"
        >
          <ChevronLeft size={16} />
          폴더
        </button>
        <span className="flex-1 text-center font-semibold text-fg text-sm truncate">
          {currentFolderName}
        </span>
        <div className="w-16" />
      </div>

      {/* 빠른 액션 */}
      <div className="flex-none px-4 pt-2 grid grid-cols-3 gap-2">
        <QuickAction Icon={Mic} label="녹음" onClick={() => navigate('/')} />
        <QuickAction Icon={Upload} label="파일 업로드" onClick={() => fileRef.current?.click()} disabled={importing} />
        <QuickAction Icon={FileText} label="새 노트" onClick={() => setShowTpl(true)} />
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="audio/*,.m4a,.mp3,.aac,.wav,.mp4,.ogg,.opus,.webm,.flac"
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
          onClick={() => setMode((v) => (v === 'list' ? 'calendar' : 'list'))}
          aria-label={mode === 'list' ? '달력 보기' : '목록 보기'}
          className="flex-none w-10 h-10 grid place-items-center rounded-full bg-surface border border-divider text-muted"
        >
          {mode === 'list' ? <CalendarDays size={18} /> : <List size={18} />}
        </button>
      </div>

      {/* 정렬 */}
      <div className="flex-none px-4 pt-2 flex justify-end">
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          aria-label="정렬 기준"
          className="text-xs bg-surface border border-divider rounded-full px-2 py-1.5 text-muted outline-none"
        >
          <option value="recent">최신순</option>
          <option value="oldest">오래된순</option>
          <option value="longest">긴 길이순</option>
        </select>
      </div>

      {/* 달력 */}
      {mode === 'calendar' && (
        <div className="flex-none px-4 pt-2">
          <MonthCalendar meetings={meetings} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
          <div className="text-xs text-muted pt-2">
            {selectedDay ? `${selectedDay} · ${filtered.length}건` : '날짜를 선택하면 그날 회의록만 봐요.'}
          </div>
        </div>
      )}

      {/* 결과 개수 */}
      {loaded && (
        <div className="flex-none px-4 pt-1 text-xs text-muted">{filtered.length}건</div>
      )}

      {/* 목록 */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2 space-y-2">
        {!loaded ? (
          <p className="text-center text-muted text-sm pt-10">불러오는 중…</p>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-12 text-muted gap-3">
            <FolderOpen size={40} className="opacity-40" />
            <p className="text-sm">
              {selectedDay ? '이 날짜의 회의록이 없어요.' : '아직 저장된 항목이 없습니다.'}
            </p>
            <p className="text-xs">
              위에서 <span className="text-primary font-semibold">녹음</span>·
              <span className="text-primary font-semibold">파일 업로드</span>·
              <span className="text-primary font-semibold">새 노트</span>로 시작하세요.
            </p>
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
                  <div className="text-xs text-muted mt-1 truncate">
                    <Highlight text={snippet(m, needle)} q={needle} />
                  </div>
                )}
              </div>
              <ChevronRight size={18} className="text-muted flex-none" />
            </button>
          ))
        )}
      </div>

      {/* 새 노트 템플릿 선택 */}
      {showTpl && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => { setShowTpl(false); setEditingTpls(false); }}
        >
          <div
            className="bg-surface rounded-2xl max-w-sm w-full p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-fg">노트 양식 선택</h3>
              <button
                type="button"
                aria-label={editingTpls ? '편집 완료' : '순서 편집'}
                onClick={() => setEditingTpls((v) => !v)}
                className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border transition ${
                  editingTpls ? 'bg-primary text-white border-primary' : 'border-divider text-muted'
                }`}
              >
                <Settings2 size={12} />
                {editingTpls ? '완료' : '순서 편집'}
              </button>
            </div>

            <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
              {orderedTpls.map((t, idx) => (
                <div
                  key={t.id}
                  className="flex items-center gap-2 rounded-xl border border-divider overflow-hidden"
                >
                  {editingTpls ? (
                    <>
                      <GripVertical size={16} className="text-muted ml-3 flex-none" />
                      <div className="flex-1 px-1 py-3">
                        <div className="text-sm font-semibold text-fg">{t.label}</div>
                        <div className="text-xs text-muted">{t.desc}</div>
                      </div>
                      <div className="flex flex-col gap-0.5 pr-2">
                        <button
                          type="button"
                          aria-label="위로"
                          onClick={() => moveTpl(idx, -1)}
                          disabled={idx === 0}
                          className="p-1 text-muted disabled:opacity-30"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          aria-label="아래로"
                          onClick={() => moveTpl(idx, 1)}
                          disabled={idx === orderedTpls.length - 1}
                          className="p-1 text-muted disabled:opacity-30"
                        >
                          <ArrowDown size={14} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void onNewNote(t)}
                      className="flex-1 flex items-center justify-between px-4 py-3 active:scale-[0.99] transition"
                    >
                      <div>
                        <div className="text-sm font-semibold text-fg text-left">{t.label}</div>
                        <div className="text-xs text-muted">{t.desc}</div>
                      </div>
                      <ChevronRight size={16} className="text-muted" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => { setShowTpl(false); setEditingTpls(false); }}
              className="w-full mt-3 rounded-full border border-divider text-muted text-sm font-semibold py-2.5"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function QuickAction({ Icon, label, onClick, disabled }: {
  Icon: typeof Mic; label: string; onClick: () => void; disabled?: boolean;
}): JSX.Element {
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
