import { create } from 'zustand';

export type ToastKind = 'info' | 'success' | 'error';
interface ToastItem { id: number; kind: ToastKind; msg: string }

interface ToastState {
  items: ToastItem[];
  show: (msg: string, kind?: ToastKind) => void;
  dismiss: (id: number) => void;
}

let seq = 1;

export const useToastStore = create<ToastState>((set) => ({
  items: [],
  show: (msg, kind = 'info') => {
    const id = seq++;
    set((s) => ({ items: [...s.items, { id, kind, msg }] }));
    setTimeout(() => set((s) => ({ items: s.items.filter((t) => t.id !== id) })), 3200);
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

/** 비-React 컨텍스트에서도 호출 가능한 헬퍼 */
export const toast = (msg: string, kind?: ToastKind) => useToastStore.getState().show(msg, kind);
