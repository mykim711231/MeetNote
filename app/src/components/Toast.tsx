import { CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import { useToastStore, type ToastKind } from '@/stores/useToastStore';

const ICON: Record<ToastKind, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  error: AlertTriangle,
};

export default function Toast(): JSX.Element | null {
  const items = useToastStore((s) => s.items);
  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-24 inset-x-0 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none">
      {items.map((t) => {
        const Icon = ICON[t.kind];
        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-center gap-2 rounded-2xl bg-surface shadow-lg border px-4 py-3 max-w-sm text-sm
              ${t.kind === 'error' ? 'border-accent text-accent' : t.kind === 'success' ? 'border-primary text-fg' : 'border-divider text-fg'}`}
          >
            <Icon size={16} className={t.kind === 'error' ? 'text-accent' : 'text-primary'} aria-hidden />
            <span className="flex-1">{t.msg}</span>
          </div>
        );
      })}
    </div>
  );
}
