import { useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { MeetingMeta } from '@/types';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function pad(n: number): string { return String(n).padStart(2, '0'); }
/** Date → 로컬 'YYYY-MM-DD' */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function MonthCalendar({
  meetings,
  selectedDay,
  onSelectDay,
}: {
  meetings: MeetingMeta[];
  selectedDay: string | null;
  onSelectDay: (day: string | null) => void;
}): JSX.Element {
  const [view, setView] = useState(() => {
    const base = selectedDay ? new Date(selectedDay) : new Date();
    return { y: base.getFullYear(), m: base.getMonth() };
  });

  // 스와이프 감지용
  const dragRef = useRef<{ startX: number; startY: number; moved: boolean } | null>(null);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const mt of meetings) {
      const d = new Date(mt.date);
      if (Number.isNaN(d.getTime())) continue;
      const k = dayKey(d);
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return map;
  }, [meetings]);

  const todayKey = dayKey(new Date());
  const firstWeekday = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const move = (delta: number) => {
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };

  // 포인터(터치·마우스) 스와이프 핸들러
  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = Math.abs(e.clientX - dragRef.current.startX);
    const dy = Math.abs(e.clientY - dragRef.current.startY);
    if (dx > 5 || dy > 5) dragRef.current.moved = true;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = Math.abs(e.clientY - dragRef.current.startY);
    // 수평 이동이 40px 이상이고, 수직 이동보다 클 때만 월 이동
    if (Math.abs(dx) > 40 && Math.abs(dx) > dy) {
      move(dx < 0 ? 1 : -1);
    }
    dragRef.current = null;
  };
  const onPointerCancel = () => { dragRef.current = null; };

  return (
    <div
      className="rounded-2xl bg-surface border border-divider p-3 select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      style={{ touchAction: 'pan-y' }}
    >
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => move(-1)} aria-label="이전 달" className="w-8 h-8 grid place-items-center text-muted">
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-bold text-fg">{view.y}년 {view.m + 1}월</span>
        <button type="button" onClick={() => move(1)} aria-label="다음 달" className="w-8 h-8 grid place-items-center text-muted">
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={`text-center text-xs py-1 ${i === 0 ? 'text-accent' : 'text-muted'}`}>{w}</div>
        ))}
        {cells.map((day, idx) => {
          if (day === null) return <div key={`e${idx}`} />;
          const key = `${view.y}-${pad(view.m + 1)}-${pad(day)}`;
          const count = counts.get(key) ?? 0;
          const isSel = selectedDay === key;
          const isToday = todayKey === key;
          return (
            <button
              key={key}
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => {
                // 스와이프 중이 아닐 때만 날짜 선택
                if (!dragRef.current || !dragRef.current.moved) {
                  onSelectDay(isSel ? null : key);
                }
                e.stopPropagation();
              }}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm relative
                ${isSel ? 'bg-primary text-white' : count > 0 ? 'text-fg' : 'text-muted/60'}
                ${isToday && !isSel ? 'ring-1 ring-primary' : ''}`}
            >
              {day}
              {count > 0 && (
                <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${isSel ? 'bg-white' : 'bg-primary'}`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
