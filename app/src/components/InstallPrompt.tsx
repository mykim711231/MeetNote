import { useEffect, useState } from 'react';
import { Download, Share, Plus, X, Smartphone } from 'lucide-react';

// 기기별 PWA 설치 안내. Android/Windows/macOS Chrome·Edge는 네이티브 프롬프트,
// iOS Safari·삼성인터넷·macOS Safari는 수동 안내 모달.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type OS = 'android' | 'ios' | 'windows' | 'mac' | 'other';

function detectOS(): OS {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Windows/i.test(ua)) return 'windows';
  if (/Mac/i.test(ua)) return 'mac';
  return 'other';
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  return (navigator as unknown as { standalone?: boolean }).standalone === true;
}

function isSamsungInternet(): boolean {
  return /SamsungBrowser/i.test(navigator.userAgent);
}

export default function InstallPrompt(): JSX.Element | null {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone());
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) return null;

  const onClick = async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === 'accepted') setInstalled(true);
      setDeferred(null);
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className="w-full flex items-center justify-center gap-2 rounded-full bg-primary text-white text-sm font-semibold py-2.5"
      >
        <Download size={16} /> 홈 화면에 앱 설치
      </button>
      {showGuide && <InstallGuide os={detectOS()} samsung={isSamsungInternet()} onClose={() => setShowGuide(false)} />}
    </>
  );
}

function InstallGuide({ os, samsung, onClose }: { os: OS; samsung: boolean; onClose: () => void }): JSX.Element {
  let steps: Array<{ icon: JSX.Element; text: string }>;
  if (os === 'ios') {
    steps = [
      { icon: <Share size={16} />, text: '하단의 공유 버튼을 누릅니다.' },
      { icon: <Plus size={16} />, text: '"홈 화면에 추가"를 선택합니다.' },
      { icon: <Smartphone size={16} />, text: '오른쪽 위 "추가"를 누르면 완료됩니다.' },
    ];
  } else if (samsung) {
    steps = [
      { icon: <Plus size={16} />, text: '주소창의 + 또는 메뉴(⋮)를 엽니다.' },
      { icon: <Smartphone size={16} />, text: '"페이지를 홈 화면에 추가"를 선택합니다.' },
    ];
  } else if (os === 'mac') {
    steps = [
      { icon: <Share size={16} />, text: 'Safari 메뉴 → 공유 → "Dock에 추가"를 선택합니다.' },
      { icon: <Smartphone size={16} />, text: 'Chrome·Edge는 주소창 오른쪽 설치 아이콘을 누르세요.' },
    ];
  } else {
    steps = [
      { icon: <Download size={16} />, text: '주소창 오른쪽 끝의 설치(⊕) 아이콘을 누릅니다.' },
      { icon: <Smartphone size={16} />, text: '없으면 브라우저 메뉴(⋮) → "앱 설치"를 선택하세요.' },
    ];
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="bg-surface rounded-2xl max-w-sm w-full p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-fg">앱 설치하기</h3>
          <button type="button" onClick={onClose} aria-label="닫기" className="text-muted p-1"><X size={20} /></button>
        </div>
        <ol className="space-y-3">
          {steps.map((s, i) => (
            <li key={i} className="flex items-center gap-3 text-sm text-fg">
              <span className="flex-none w-8 h-8 rounded-full bg-primary/10 text-primary grid place-items-center">{s.icon}</span>
              <span>{s.text}</span>
            </li>
          ))}
        </ol>
        <button type="button" onClick={onClose} className="w-full mt-5 rounded-full bg-primary text-white text-sm font-semibold py-2.5">알겠어요</button>
      </div>
    </div>
  );
}
