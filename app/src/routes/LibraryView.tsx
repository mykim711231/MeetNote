import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Mic, ChevronRight, FolderOpen, Pin } from 'lucide-react';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { fmtDate, fmtDuration } from '@/lib/format';
import type { MeetingMeta } from '@/types';

type Sort = 'recent' | 'oldest' | 'longest';

/** 검색어와 일치하는 부분을 <mark>로 강조 */
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

/** 검색어가 있으면 매치 주변을, 없으면 앞부분을 발췌 */
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
  const { meetings, folders, loaded, load } = useMeetingStore();
  const [q, setQ] = useState('');
  const [folderId, setFolderId] = useState<string | 'all'>('all');
  const [sort, setSort] = useState<Sort>('recent');

  useEffect(() => { if (!loaded) void load(); }, [loaded, load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = meetings.filter((m) => {
      if (folderId !== 'all' && m.folderId !== folderId) return false;
      if (!needle) return true;
      if (m.title.toLowerCase().includes(needle)) return true;
      return m.segments.some((s) => s.text.toLowerCase().includes(needle));
    });
    const sorted = [...list];
    if (sort === 'oldest') sorted.reverse();          // meetings는 최신순 → 뒤집으면 오래된순
    else if (sort === 'longest') sorted.sort((a, b) => b.duration - a.duration);
    // 고정 회의록을 항상 상단으로 (안정 정렬 → 그룹 내 순서 유지)
    sorted.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    return sorted;
  }, [meetings, q, folderId, sort]);

  const needle = q.trim();

  const stats = useMemo(() => {
    const totalMs = meetings.reduce((a, m) => a + m.duration, 0);
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    const thisWeek = meetings.filter((m) => {
      const t = new Date(m.date).getTime();
      return Number.isFinite(t) && t >= weekAgo;
    }).length;
    return { total: meetings.length, totalMs, thisWeek };
  }, [meetings]);

  const showStats = loaded && meetings.length > 0 && !needle && folderId === 'all';

  return (
    <div className="flex flex-col h-full">
      {/* 검색 */}
      <div className="flex-none px-4 pt-3">
        <div className="flex items-center gap-2 rounded-full bg-surface border border-divider px-3 py-2">
          <Search size={18} className="text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="제목·내용 검색"
            aria-label="제목 또는 내용 검색"
            className="flex-1 bg-transparent outline-none text-sm text-fg placeholder:text-muted/60"
          />
        </div>
      </div>

      {/* 폴더 필터 + 정렬 */}
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

      {/* 결과 개수 */}
      {loaded && meetings.length > 0 && (
        <div className="flex-none px-4 pt-2 text-xs text-muted">{filtered.length}건</div>
      )}

      {/* 통계 */}
      {showStats && (
        <div className="flex-none px-4 pt-3">
          <div className="grid grid-cols-3 rounded-2xl bg-surface border border-divider divide-x divide-divider">
            {[
              { label: '회의록', value: `${stats.total}건` },
              { label: '총 시간', value: fmtDuration(stats.totalMs) },
              { label: '이번 주', value: `${stats.thisWeek}건` },
            ].map((c) => (
              <div key={c.label} className="py-2.5 text-center">
                <div className="text-base font-bold text-fg tabular-nums">{c.value}</div>
                <div className="text-xs text-muted mt-0.5">{c.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 목록 */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2 space-y-2">
        {!loaded ? (
          <p className="text-center text-muted text-sm pt-10">불러오는 중…</p>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-16 text-muted gap-3">
            {meetings.length === 0 ? (
              <>
                <Mic size={40} className="opacity-40" />
                <p className="text-sm">아직 저장된 회의록이 없습니다.</p>
              </>
            ) : (
              <>
                <FolderOpen size={40} className="opacity-40" />
                <p className="text-sm">검색 결과가 없습니다.</p>
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
                <div className="text-xs text-muted mt-0.5">{fmtDate(m.date)} · {fmtDuration(m.duration)}</div>
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
