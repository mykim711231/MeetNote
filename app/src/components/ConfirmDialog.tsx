import { useConfirmStore } from '@/stores/useConfirmStore';

export default function ConfirmDialog(): JSX.Element | null {
  const { open, opts, answer } = useConfirmStore();
  if (!open || !opts) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      onClick={() => answer(false)}
    >
      <div className="bg-surface rounded-2xl max-w-xs w-full p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm text-fg leading-relaxed whitespace-pre-line">{opts.message}</p>
        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={() => answer(false)}
            className="flex-1 rounded-full border border-divider text-muted text-sm font-semibold py-2.5"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => answer(true)}
            className={`flex-1 rounded-full text-white text-sm font-semibold py-2.5 ${opts.danger ? 'bg-accent' : 'bg-primary'}`}
          >
            {opts.confirmLabel ?? '확인'}
          </button>
        </div>
      </div>
    </div>
  );
}
