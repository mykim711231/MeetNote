import { create } from 'zustand';

export type Theme = 'light' | 'dark';
export type AiProvider = 'gemini' | 'groq';

export const AI_PROVIDERS = [
  { id: 'gemini' as const, label: 'Google Gemini', model: 'gemini-2.0-flash', keyUrl: 'https://aistudio.google.com/app/apikey' },
  { id: 'groq' as const, label: 'Groq (Llama)', model: 'llama-3.3-70b-versatile', keyUrl: 'https://console.groq.com/keys' },
] as const;

export function aiModelFor(provider: AiProvider): string {
  return AI_PROVIDERS.find((p) => p.id === provider)?.model ?? 'gemini-2.0-flash';
}

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
  denoise: boolean;         // 녹음 노이즈 감소
  aiProvider: AiProvider;   // AI 요약 제공자
  aiKey: string;            // AI API 키 (비어 있으면 AI 비활성 — 기기에만 저장)
  supabaseUrl: string;      // Supabase project URL (비어 있으면 동기화 비활성)
  supabaseKey: string;      // Supabase anon key (기기에만 저장)
  assemblyAiKey: string;    // AssemblyAI API 키 (화자 분리 전사 — 기기에만 저장)
  toggleTheme: () => void;
  setFontScale: (v: number) => void;
  setSttLang: (lang: string) => void;
  setDenoise: (v: boolean) => void;
  setAiProvider: (p: AiProvider) => void;
  setAiKey: (k: string) => void;
  setSupabase: (url: string, key: string) => void;
  setAssemblyAiKey: (k: string) => void;
}

const PREF_KEY = 'meetnote.prefs.v1';

interface Stored {
  theme: Theme; fontScale: number; sttLang: string; denoise: boolean;
  aiProvider: AiProvider; aiKey: string;
  supabaseUrl: string; supabaseKey: string; assemblyAiKey: string;
}

function load(): Stored {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Stored>;
      return {
        theme: p.theme === 'dark' ? 'dark' : 'light',
        fontScale: typeof p.fontScale === 'number' ? p.fontScale : 1,
        sttLang: typeof p.sttLang === 'string' ? p.sttLang : 'ko-KR',
        denoise: typeof p.denoise === 'boolean' ? p.denoise : false,
        aiProvider: p.aiProvider === 'groq' ? 'groq' : 'gemini',
        aiKey: typeof p.aiKey === 'string' ? p.aiKey : '',
        supabaseUrl: typeof p.supabaseUrl === 'string' ? p.supabaseUrl : '',
        supabaseKey: typeof p.supabaseKey === 'string' ? p.supabaseKey : '',
        assemblyAiKey: typeof p.assemblyAiKey === 'string' ? p.assemblyAiKey : '',
      };
    }
  } catch { /* noop */ }
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  // 기본 꺼짐: 회의·주변음(먼 화자·TV 등)을 그대로 담기 위해. 가까운 1:1은 설정에서 켜기.
  return { theme: prefersDark ? 'dark' : 'light', fontScale: 1, sttLang: 'ko-KR', denoise: false, aiProvider: 'gemini', aiKey: '', supabaseUrl: '', supabaseKey: '', assemblyAiKey: '' };
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

export const usePrefStore = create<PrefState>((set, get) => {
  // 현재 상태 전체를 직렬화 — 필드가 늘어도 누락 없이 저장
  const save = (patch: Partial<Stored>) => {
    const { theme, fontScale, sttLang, denoise, aiProvider, aiKey, supabaseUrl, supabaseKey, assemblyAiKey } = get();
    persist({ theme, fontScale, sttLang, denoise, aiProvider, aiKey, supabaseUrl, supabaseKey, assemblyAiKey, ...patch });
  };
  return {
    theme: initial.theme,
    fontScale: initial.fontScale,
    sttLang: initial.sttLang,
    denoise: initial.denoise,
    aiProvider: initial.aiProvider,
    aiKey: initial.aiKey,
    supabaseUrl: initial.supabaseUrl,
    supabaseKey: initial.supabaseKey,
    assemblyAiKey: initial.assemblyAiKey,
    toggleTheme: () =>
      set((s) => {
        const theme: Theme = s.theme === 'dark' ? 'light' : 'dark';
        applyPrefs(theme, s.fontScale);
        save({ theme });
        return { theme };
      }),
    setFontScale: (v) =>
      set((s) => {
        const fontScale = Math.min(1.4, Math.max(0.9, Math.round(v * 100) / 100));
        applyPrefs(s.theme, fontScale);
        save({ fontScale });
        return { fontScale };
      }),
    setSttLang: (lang) => { save({ sttLang: lang }); set({ sttLang: lang }); },
    setDenoise: (v) => { save({ denoise: v }); set({ denoise: v }); },
    setAiProvider: (p) => { save({ aiProvider: p }); set({ aiProvider: p }); },
    setAiKey: (k) => { const aiKey = k.trim(); save({ aiKey }); set({ aiKey }); },
    setSupabase: (url, key) => {
      const supabaseUrl = url.trim().replace(/\/$/, '');
      const supabaseKey = key.trim();
      save({ supabaseUrl, supabaseKey });
      set({ supabaseUrl, supabaseKey });
    },
    setAssemblyAiKey: (k) => { const assemblyAiKey = k.trim(); save({ assemblyAiKey }); set({ assemblyAiKey }); },
  };
});
