/**
 * Zustand store, persisted into chrome.storage.local. Used by every UI surface
 * (sidepanel, popup, options) so they all see the same workspace list. The SW
 * keeps Drive in sync via lib/sync.ts and broadcasts updates via chrome.storage
 * change events that this store listens to.
 */
import { create } from 'zustand';
import type {
  Settings,
  SyncStatus,
  UserProfile,
  Workspace,
} from './types';
import { DEFAULT_SETTINGS } from './types';

const KEY_WORKSPACES = 'tabsync.workspaces';
const KEY_SETTINGS = 'tabsync.settings';
const KEY_SYNC = 'tabsync.sync';
const KEY_PROFILE = 'tabsync.profile';

interface State {
  workspaces: Workspace[];
  settings: Settings;
  sync: SyncStatus;
  profile: UserProfile | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  upsertLocal: (ws: Workspace) => Promise<void>;
  removeLocal: (id: string) => Promise<void>;
  setWorkspaces: (list: Workspace[]) => Promise<void>;
  setSettings: (s: Partial<Settings>) => Promise<void>;
}

export const useStore = create<State>((set, get) => ({
  workspaces: [],
  settings: DEFAULT_SETTINGS,
  sync: { state: 'idle' },
  profile: null,
  hydrated: false,

  hydrate: async () => {
    const r = await chrome.storage.local.get([KEY_WORKSPACES, KEY_SETTINGS, KEY_SYNC, KEY_PROFILE]);
    set({
      workspaces: (r[KEY_WORKSPACES] as Workspace[]) ?? [],
      settings: { ...DEFAULT_SETTINGS, ...((r[KEY_SETTINGS] as Settings) ?? {}) },
      sync: (r[KEY_SYNC] as SyncStatus) ?? { state: 'idle' },
      profile: (r[KEY_PROFILE] as UserProfile) ?? null,
      hydrated: true,
    });
  },

  upsertLocal: async (ws) => {
    const existing = get().workspaces;
    const idx = existing.findIndex((w) => w.id === ws.id);
    const next = idx === -1 ? [ws, ...existing] : existing.map((w) => (w.id === ws.id ? ws : w));
    await chrome.storage.local.set({ [KEY_WORKSPACES]: next });
    set({ workspaces: next });
  },

  removeLocal: async (id) => {
    const next = get().workspaces.filter((w) => w.id !== id);
    await chrome.storage.local.set({ [KEY_WORKSPACES]: next });
    set({ workspaces: next });
  },

  setWorkspaces: async (list) => {
    await chrome.storage.local.set({ [KEY_WORKSPACES]: list });
    set({ workspaces: list });
  },

  setSettings: async (patch) => {
    const next = { ...get().settings, ...patch };
    await chrome.storage.local.set({ [KEY_SETTINGS]: next });
    set({ settings: next });
  },
}));

// Cross-surface sync: when storage changes (e.g. SW writes a workspace), refresh local state.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  const patch: Partial<State> = {};
  if (changes[KEY_WORKSPACES]) patch.workspaces = (changes[KEY_WORKSPACES].newValue as Workspace[]) ?? [];
  if (changes[KEY_SETTINGS]) patch.settings = { ...DEFAULT_SETTINGS, ...((changes[KEY_SETTINGS].newValue as Settings) ?? {}) };
  if (changes[KEY_SYNC]) patch.sync = (changes[KEY_SYNC].newValue as SyncStatus) ?? { state: 'idle' };
  if (changes[KEY_PROFILE]) patch.profile = (changes[KEY_PROFILE].newValue as UserProfile) ?? null;
  if (Object.keys(patch).length) useStore.setState(patch);
});

export const STORAGE_KEYS = {
  workspaces: KEY_WORKSPACES,
  settings: KEY_SETTINGS,
  sync: KEY_SYNC,
  profile: KEY_PROFILE,
};
