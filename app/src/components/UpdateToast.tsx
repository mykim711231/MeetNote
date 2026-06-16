import { Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { useUpdateStore, type UpdatePhase } from '@/stores/useUpdateStore';

function ProgressBar({ pct }: { pct: number }): JSX.Element {
  return (
    <div className="w-full h-1.5 rounded-full bg-divider/40 overflow-hidden">
      <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

const PHASE_LABEL: Record<UpdatePhase, string> = {
  idle: '',
  downloading: '오프라인 데이터 준비 중…',
  installing: '설치 완료',
  error: '업데이트 실패',
};

export default function UpdateToast(): JSX.Element | null {
  const { ui, retrySW, dismiss } = useUpdateStore();
  if (ui.phase === 'idle') return null;

  return (
    <div className="fixed top-16 inset-x-0 z-50 flex justify-center px-4 pointer-events-none" role="status" aria-live="polite">
      <div className={`pointer-events-auto rounded-2xl bg-surface shadow-lg border px-4 py-3 max-w-sm min-w-[200px] space-y-2 ${ui.phase === 'error' ? 'border-accent' : 'border-primary'}`}>
        <div className="flex items-center gap-2">
          {ui.phase === 'downloading' && <Loader2 size={14} className="animate-spin text-primary" />}
          {ui.phase === 'error' && <AlertTriangle size={14} className="text-accent" />}
          <span className="text-sm text-fg font-medium flex-1">{PHASE_LABEL[ui.phase]}</span>
        </div>
        {ui.pct > 0 && ui.pct < 100 && <ProgressBar pct={ui.pct} />}
        {ui.phase === 'error' && (
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => retrySW?.()} className="inline-flex items-center gap-1.5 rounded-full bg-primary text-white text-xs font-bold px-4 py-1.5 flex-1 justify-center">
              <RefreshCw size={12} /> 다시 시도
            </button>
            <button type="button" onClick={() => dismiss()} className="rounded-full border border-divider text-muted text-xs font-bold px-4 py-1.5">
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
