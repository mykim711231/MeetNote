// 음량 레벨 미터 — 12칸 막대
const BARS = 12;

export default function LevelMeter({ level, active }: { level: number; active: boolean }): JSX.Element {
  const lit = Math.round(level * BARS);
  return (
    <div className="flex items-end justify-center gap-1 h-12" aria-hidden>
      {Array.from({ length: BARS }, (_, i) => {
        const on = active && i < lit;
        const h = 20 + (i / BARS) * 80; // 20% ~ 100%
        return (
          <div
            key={i}
            className={`w-1.5 rounded-full transition-colors duration-75 ${on ? 'bg-accent' : 'bg-divider'}`}
            style={{ height: `${h}%` }}
          />
        );
      })}
    </div>
  );
}
