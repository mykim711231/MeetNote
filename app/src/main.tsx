import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useUpdateStore } from '@/stores/useUpdateStore';
import './styles/tokens.css';
import './styles/index.css';

// ── SW 등록 (B방식: 다음 실행 시 silent 적용) ──
const updateSW = registerSW({
  onRegisteredSW(_swUrl, r) {
    if (!r) return;
    if (r.waiting) return;
    if (r.installing) {
      const sw = r.installing; // statechange 발화 시점엔 r.installing이 null이 되므로 지금 캡처
      useUpdateStore.getState().setPhase('downloading', 0);
      sw.addEventListener('statechange', () => {
        if (sw.state === 'installed') {
          useUpdateStore.getState().setPhase('installing', 100);
          setTimeout(() => useUpdateStore.getState().dismiss(), 1800);
        }
      });
      return;
    }
    r.update().catch(() => {});
  },
  onNeedRefresh() {
    useUpdateStore.getState().dismiss();
  },
  onOfflineReady() {},
});
useUpdateStore.getState().setRetryFn(() => void updateSW(true));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <App />
      </HashRouter>
    </ErrorBoundary>
  </StrictMode>
);
