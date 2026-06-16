import { useEffect, useState } from 'react';
import { Moon, Sun, Type } from 'lucide-react';
import { usePrefStore } from '@/stores/usePrefStore';

function Clock(): JSX.Element {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(t);
  }, []);
  const p = (n: number) => String(n).padStart(2, '0');
  return <span className="text-sm tabular-nums text-muted">{p(now.getHours())}:{p(now.getMinutes())}</span>;
}

export default function TopBar(): JSX.Element {
  const { theme, toggleTheme, fontScale, setFontScale } = usePrefStore();

  const cycleFont = () => {
    const steps = [0.9, 1, 1.1, 1.25, 1.4];
    const i = steps.findIndex((s) => Math.abs(s - fontScale) < 0.01);
    setFontScale(steps[(i + 1) % steps.length]);
  };

  return (
    <header className="flex-none flex items-center justify-between px-4 h-14 border-b border-divider bg-surface pt-safe">
      <h1 className="text-lg font-bold text-fg select-none">
        MeetNote<span className="text-primary">.</span>
      </h1>
      <div className="flex items-center gap-1">
        <button type="button" onClick={cycleFont} aria-label="글자 크기" className="w-10 h-10 grid place-items-center rounded-full text-muted hover:bg-divider/40">
          <Type size={18} />
        </button>
        <button type="button" onClick={toggleTheme} aria-label="테마 전환" className="w-10 h-10 grid place-items-center rounded-full text-muted hover:bg-divider/40">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <Clock />
      </div>
    </header>
  );
}
