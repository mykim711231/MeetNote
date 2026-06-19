import { useRef, useState } from 'react';

const KEY = 'meetnote.onboarded.v2';

const SLIDES = [
  {
    emoji: '🎙️',
    title: '탭 하나로 시작합니다',
    desc: '버튼을 누르면 바로 녹음과 자막이 시작됩니다.\n설정할 것 없이 그냥 누르면 돼요.',
    accent: 'from-red-500/15',
  },
  {
    emoji: '✨',
    title: '끝나면 자동으로 정리됩니다',
    desc: '핵심 요약, 결정 사항, 할 일이\n자동으로 만들어집니다.',
    accent: 'from-purple-500/15',
  },
  {
    emoji: '🔒',
    title: '모든 기록은 이 기기에만',
    desc: '서버·계정·비용 없이\n완전히 오프라인으로 동작합니다.',
    accent: 'from-green-500/15',
  },
] as const;

export default function Onboarding(): JSX.Element | null {
  const [show, setShow] = useState(() => {
    try { return !localStorage.getItem(KEY); } catch { return false; }
  });
  const [slide, setSlide] = useState(0);
  const touchStartX = useRef(0);

  if (!show) return null;

  const close = () => {
    try { localStorage.setItem(KEY, '1'); } catch { /* noop */ }
    setShow(false);
  };

  const next = () => {
    if (slide < SLIDES.length - 1) setSlide(slide + 1);
    else close();
  };

  const prev = () => { if (slide > 0) setSlide(slide - 1); };

  const isLast = slide === SLIDES.length - 1;
  const { emoji, title, desc, accent } = SLIDES[slide];

  return (
    <div
      className={`fixed inset-0 z-[70] bg-gradient-to-b ${accent} via-bg to-bg flex flex-col select-none transition-all duration-300`}
      onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        if (dx < -50) next();
        if (dx > 50) prev();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="시작 안내"
    >
      {/* 건너뜀 */}
      {!isLast && (
        <button
          type="button"
          onClick={close}
          className="absolute top-5 right-5 text-sm text-muted font-medium px-3 py-1"
        >
          건너뜀
        </button>
      )}

      {/* 콘텐츠 */}
      <div className="flex-1 flex flex-col items-center justify-center px-10 text-center gap-10">
        <div
          className="w-32 h-32 rounded-full bg-surface flex items-center justify-center shadow-lg"
          style={{ fontSize: '4rem' }}
        >
          {emoji}
        </div>
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-fg leading-tight">{title}</h2>
          <p className="text-base text-muted leading-relaxed whitespace-pre-line">{desc}</p>
        </div>
      </div>

      {/* 하단: 점 + 버튼 */}
      <div className="flex-none flex flex-col items-center gap-6 pb-14 px-8">
        <div className="flex gap-2">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSlide(i)}
              aria-label={`${i + 1}번 슬라이드`}
              className={`rounded-full transition-all duration-300 ${
                i === slide ? 'w-7 h-2.5 bg-primary' : 'w-2.5 h-2.5 bg-divider'
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={next}
          className="w-full max-w-xs rounded-full bg-primary text-white text-base font-bold py-4 active:scale-95 transition-transform shadow-md"
        >
          {isLast ? '시작하기' : '다음'}
        </button>
      </div>
    </div>
  );
}
