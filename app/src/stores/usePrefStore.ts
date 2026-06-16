import { create } from 'zustand';

export type Theme = 'light' | 'dark';

export const STT_LANGS = [
  { code: 'ko-KR', label: '한국어' },
  { code: 'en-US', label: 'English' },
  { code: 'ja-JP', label: '日本語' },
  { code: 'zh-CN', label: '中文' },
] as const;

interface PrefState {
  theme: Theme;
  fontScale: number;        // 0.9 ~ 1.4
  sttLang: string;          // 실시간 자막 인식 언어
  toggleTheme: () => void;
  setFontScale: (v: number) => void;
  setSttLang: (lang: string) => void;
}

const PREF_KEY = 'meetnote.prefs.v1';

interface Stored { theme: Theme; fontScale: number; sttLang: string }

function load(): Stored {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Stored>;
      return {
        theme: p.theme === 'dark' ? 'dark' : 'light',
        fontScale: typeof p.fontScale === 'number' ? p.fontScale : 1,
        sttLang: typeof p.sttLang === 'string' ? p.sttLang : 'ko-KR',
      };
    }
  } catch { /* noop */ }
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  return { theme: prefersDark ? 'dark' : 'light', fontScale: 1, sttLang: 'ko-KR' };
}

function persist(s: Stored): void {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(s));
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

export const usePrefStore = create<PrefState>((set, get) => ({
  theme: initial.theme,
  fontScale: initial.fontScale,
  sttLang: initial.sttLang,
  toggleTheme: () =>
    set((s) => {
      const theme: Theme = s.theme === 'dark' ? 'light' : 'dark';
      applyPrefs(theme, s.fontScale);
      persist({ theme, fontScale: s.fontScale, sttLang: s.sttLang });
      return { theme };
    }),
  setFontScale: (v) =>
    set((s) => {
      const fontScale = Math.min(1.4, Math.max(0.9, Math.round(v * 100) / 100));
      applyPrefs(s.theme, fontScale);
      persist({ theme: s.theme, fontScale, sttLang: s.sttLang });
      return { fontScale };
    }),
  setSttLang: (lang) => {
    const { theme, fontScale } = get();
    persist({ theme, fontScale, sttLang: lang });
    set({ sttLang: lang });
  },
}));
