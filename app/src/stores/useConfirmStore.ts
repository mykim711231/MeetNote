import { create } from 'zustand';

// iOS standalone PWA에서 window.confirm()이 차단되는 문제를 우회하는 공용 확인 다이얼로그

interface ConfirmOptions {
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

interface ConfirmState {
  open: boolean;
  opts: ConfirmOptions | null;
  resolve: ((ok: boolean) => void) | null;
  ask: (opts: ConfirmOptions) => Promise<boolean>;
  answer: (ok: boolean) => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  opts: null,
  resolve: null,
  ask: (opts) =>
    new Promise<boolean>((resolve) => {
      set({ open: true, opts, resolve });
    }),
  answer: (ok) => {
    get().resolve?.(ok);
    set({ open: false, opts: null, resolve: null });
  },
}));

/** 비-React 컨텍스트에서도 호출 가능한 헬퍼 */
export const confirmDialog = (opts: ConfirmOptions): Promise<boolean> =>
  useConfirmStore.getState().ask(opts);
