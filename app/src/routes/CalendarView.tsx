import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, FileText, ChevronRight, Plus } from 'lucide-react';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { fmtDuration } from '@/lib/format';
import MonthCalendar, { dayKey } from '@/components/MonthCalendar';
import type { MeetingMeta } from '@/types';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function fmtDayHeader(key: string): string {
  const d = new Date(key);
  const today = dayKey(new Date());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000));
  const tomorrow = dayKey(new Date(Date.now() + 86_400_000));
  const label =
    key === today ? '오늘'
    : key === yesterday ? '어제'
    : key === tomorrow ? '내일'
    : null;
  const base = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} (${WEEKDAYS[d.getDay()]})`;
  return label ? `${base} — ${label}` : base;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function MeetingCard({ m }: { m: MeetingMeta }): JSX.Element {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(`/m/${m.id}`)}
      className="w-full text-left flex items-center gap-3 rounded-2xl bg-surface border border-divider px-4 py-3 active:scale-[0.99] transition"
    >
      <div className={`w-10 h-10 rounded-xl flex-none grid place-items-center ${
        m.hasAudio ? 'bg-primary/10' : 'bg-divider/40'
      }`}>
        {m.hasAudio
          ? <Mic size={18} className="text-primary" />
          : <FileText size={18} className="text-muted" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-fg truncate text-sm">{m.title}</div>
        <div className="text-xs text-muted mt-0.5">
          {fmtTime(m.date)}
          {m.hasAudio && ` · ${fmtDuration(m.duration)}`}
          {!m.hasAudio && ' · 노트'}
        </div>
      </div>
      <ChevronRight size={16} className="text-muted flex-none" />
    </button>
  );
}

export default function CalendarView(): JSX.Element {
  const navigate = useNavigate();
  const { meetings, loaded, load } = useMeetingStore();
  const [selectedDay, setSelectedDay] = useState<string>(() => dayKey(new Date()));

  useEffect(() => { if (!loaded) void load(); }, [loaded, load]);

  const dayMeetings = useMemo(() => {
    return meetings
      .filter((m) => {
        const d = new Date(m.date);
        return !Number.isNaN(d.getTime()) && dayKey(d) === selectedDay;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [meetings, selectedDay]);

  return (
    <div className="flex flex-col h-full">
      {/* 월 달력 */}
      <div className="flex-none px-4 pt-3">
        <MonthCalendar
          meetings={meetings}
          selectedDay={selectedDay}
          onSelectDay={(day) => { if (day) setSelectedDay(day); }}
        />
      </div>

      {/* 선택한 날짜 헤더 + 목록 */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <span className="text-xs font-bold text-muted tracking-wide">
            {fmtDayHeader(selectedDay)}
          </span>
          {/* 이 날짜로 새 노트 빠른 생성 */}
          <button
            type="button"
            aria-label="새 노트"
            onClick={() => navigate('/library')}
            className="w-7 h-7 rounded-full bg-primary/10 grid place-items-center text-primary"
          >
            <Plus size={15} />
          </button>
        </div>

        <div className="px-4 pb-4 space-y-2">
          {!loaded ? (
            <p className="text-center text-muted text-sm pt-6">불러오는 중…</p>
          ) : dayMeetings.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-8 gap-2 text-muted">
              <p className="text-sm">이 날에 기록이 없습니다.</p>
              <p className="text-xs">녹음하거나 새 노트를 만들어보세요.</p>
            </div>
          ) : (
            dayMeetings.map((m) => <MeetingCard key={m.id} m={m} />)
          )}
        </div>
      </div>
    </div>
  );
}
