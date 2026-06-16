import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Mic, ChevronRight, FolderOpen } from 'lucide-react';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { fmtDate, fmtDuration } from '@/lib/format';
import type { MeetingMeta } from '@/types';

function snippet(m: MeetingMeta): string {
  const text = m.segments.map((s) => s.text).join(' ');
  return text.slice(0, 80);
}

export default function LibraryView(): JSX.Element {
  const navigate = useNavigate();
  const { meetings, folders, loaded, load } = useMeetingStore();
  const [q, setQ] = useState('');
  const [folderId, setFolderId] = useState<string | 'all'>('all');

  useEffect(() => { if (!loaded) void load(); }, [loaded, load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return meetings.filter((m) => {
      if (folderId !== 'all' && m.folderId !== folderId) return false;
      if (!needle) return true;
      if (m.title.toLowerCase().includes(needle)) return true;
      return m.segments.some((s) => s.text.toLowerCase().includes(needle));
    });
  }, [meetings, q, folderId]);

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

      {/* 폴더 필터 */}
      {folders.length > 0 && (
        <div className="flex-none px-4 pt-3 flex gap-2 overflow-x-auto">
          <Chip active={folderId === 'all'} onClick={() => setFolderId('all')} label="전체" />
          {folders.map((f) => (
            <Chip key={f.id} active={folderId === f.id} onClick={() => setFolderId(f.id)} label={f.name} />
          ))}
        </div>
      )}

      {/* 목록 */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2">
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
                <div className="font-semibold text-fg truncate">{m.title}</div>
                <div className="text-xs text-muted mt-0.5">{fmtDate(m.date)} · {fmtDuration(m.duration)}</div>
                {snippet(m) && <div className="text-xs text-muted mt-1 truncate">{snippet(m)}</div>}
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
