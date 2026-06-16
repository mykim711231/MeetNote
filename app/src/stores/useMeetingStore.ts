import { create } from 'zustand';
import type { MeetingMeta, Folder } from '@/types';
import {
  listMeetings,
  saveMeeting as dbSave,
  updateMeta as dbUpdate,
  deleteMeeting as dbDelete,
  reconcileIndex,
} from '@/lib/db';

const FOLDER_KEY = 'meetnote.folders.v1';

function loadFolders(): Folder[] {
  try {
    const raw = localStorage.getItem(FOLDER_KEY);
    if (raw) {
      const arr = JSON.parse(raw) as Folder[];
      if (Array.isArray(arr)) return arr.filter((f) => f && typeof f.id === 'string');
    }
  } catch { /* noop */ }
  return [];
}

function persistFolders(folders: Folder[]): void {
  try {
    localStorage.setItem(FOLDER_KEY, JSON.stringify(folders));
  } catch { /* noop */ }
}

interface MeetingState {
  meetings: MeetingMeta[];
  folders: Folder[];
  loaded: boolean;
  load: () => Promise<void>;
  saveNew: (meta: MeetingMeta, audio: Blob | null) => Promise<void>;
  update: (meta: MeetingMeta) => Promise<void>;
  remove: (id: number) => Promise<void>;
  addFolder: (name: string) => Folder;
  removeFolder: (id: string) => Promise<void>;
}

export const useMeetingStore = create<MeetingState>((set, get) => ({
  meetings: [],
  folders: loadFolders(),
  loaded: false,

  load: async () => {
    await reconcileIndex().catch(() => {});
    const meetings = await listMeetings();
    set({ meetings, loaded: true });
  },

  saveNew: async (meta, audio) => {
    await dbSave(meta, audio);
    set((s) => ({ meetings: [meta, ...s.meetings.filter((m) => m.id !== meta.id)] }));
  },

  update: async (meta) => {
    await dbUpdate(meta);
    set((s) => ({ meetings: s.meetings.map((m) => (m.id === meta.id ? meta : m)) }));
  },

  remove: async (id) => {
    await dbDelete(id);
    set((s) => ({ meetings: s.meetings.filter((m) => m.id !== id) }));
  },

  addFolder: (name) => {
    const folder: Folder = { id: `f${Date.now()}`, name: name.trim() || '새 폴더' };
    const folders = [...get().folders, folder];
    persistFolders(folders);
    set({ folders });
    return folder;
  },

  removeFolder: async (id) => {
    const folders = get().folders.filter((f) => f.id !== id);
    persistFolders(folders);
    // 해당 폴더 소속 회의는 미분류로 이동
    const affected = get().meetings.filter((m) => m.folderId === id);
    for (const m of affected) {
      const next = { ...m, folderId: null };
      await dbUpdate(next);
    }
    set((s) => ({
      folders,
      meetings: s.meetings.map((m) => (m.folderId === id ? { ...m, folderId: null } : m)),
    }));
  },
}));
