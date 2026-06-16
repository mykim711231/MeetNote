import { create } from 'zustand';

export type Theme = 'light' | 'dark';

interface PrefState {
  theme: Theme;
  fontScale: number;        // 0.9 ~ 1.4
  toggleTheme: () => void;
  setFontScale: (v: number) => void;
}

const PREF_KEY = 'meetnote.prefs.v1';

function load(): { theme: Theme; fontScale: number } {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<{ theme: Theme; fontScale: number }>;
      return {
        theme: p.theme === 'dark' ? 'dark' : 'light',
        fontScale: typeof p.fontScale === 'number' ? p.fontScale : 1,
      };
    }
  } catch { /* noop */ }
  // 최초: OS 다크모드 선호 반영
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  return { theme: prefersDark ? 'dark' : 'light', fontScale: 1 };
}

function persist(theme: Theme, fontScale: number): void {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify({ theme, fontScale }));
  } catch { /* noop */ }
}

/** html 요소에 테마·폰트 스케일 적용 */
export function applyPrefs(theme: Theme, fontScale: number): void {
  const el = document.documentElement;
  el.classList.toggle('dark', theme === 'dark');
  el.style.setProperty('--font-scale', String(fontScale));
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0f1115' : '#4f46e5');
}

const initial = load();
applyPrefs(initial.theme, initial.fontScale);

export const usePrefStore = create<PrefState>((set) => ({
  theme: initial.theme,
  fontScale: initial.fontScale,
  toggleTheme: () =>
    set((s) => {
      const theme: Theme = s.theme === 'dark' ? 'light' : 'dark';
      applyPrefs(theme, s.fontScale);
      persist(theme, s.fontScale);
      return { theme };
    }),
  setFontScale: (v) =>
    set((s) => {
      const fontScale = Math.min(1.4, Math.max(0.9, Math.round(v * 100) / 100));
      applyPrefs(s.theme, fontScale);
      persist(s.theme, fontScale);
      return { fontScale };
    }),
}));
