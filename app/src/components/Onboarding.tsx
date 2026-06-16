import { useState } from 'react';
import { Mic, Library, ShieldCheck } from 'lucide-react';

const KEY = 'meetnote.onboarded.v1';

const POINTS = [
  { Icon: Mic, title: '녹음 + 자동 자막', desc: '말하면 실시간으로 자막이 만들어져요. (Chrome·Edge 권장)' },
  { Icon: Library, title: '요약 · 할 일 정리', desc: '저장한 회의록에서 핵심 요약과 할 일을 자동으로 뽑아줘요.' },
  { Icon: ShieldCheck, title: '내 기기에만 저장', desc: '서버 없이 기기 안에만 저장돼요. 중요한 건 설정에서 백업하세요.' },
];

export default function Onboarding(): JSX.Element | null {
  const [show, setShow] = useState(() => {
    try { return !localStorage.getItem(KEY); } catch { return false; }
  });
  if (!show) return null;

  const close = () => {
    try { localStorage.setItem(KEY, '1'); } catch { /* noop */ }
    setShow(false);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-5" role="dialog" aria-modal="true" aria-label="시작 안내">
      <div className="bg-surface rounded-2xl max-w-sm w-full p-6 shadow-xl">
        <h2 className="text-xl font-bold text-fg text-center">MeetNote에 오신 걸 환영해요</h2>
        <ul className="mt-5 space-y-4">
          {POINTS.map(({ Icon, title, desc }) => (
            <li key={title} className="flex gap-3">
              <span className="flex-none w-10 h-10 rounded-full bg-primary/10 text-primary grid place-items-center"><Icon size={20} /></span>
              <div>
                <p className="text-sm font-semibold text-fg">{title}</p>
                <p className="text-xs text-muted mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </li>
          ))}
        </ul>
        <button type="button" onClick={close} className="w-full mt-6 rounded-full bg-primary text-white text-sm font-semibold py-3">
          시작하기
        </button>
      </div>
    </div>
  );
}
