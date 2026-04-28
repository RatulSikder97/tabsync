export type TabGroupColor =
  | 'grey' | 'blue' | 'red' | 'yellow' | 'green' | 'pink' | 'purple' | 'cyan' | 'orange';

export const TAB_GROUP_COLORS: TabGroupColor[] = [
  'grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange',
];

export interface SavedTab {
  url: string;
  title: string;
  favIconUrl?: string;
  pinned?: boolean;
}

export interface SavedTabGroup {
  id: string;
  name: string;
  color: TabGroupColor;
  collapsed?: boolean;
  tabs: SavedTab[];
}

export interface WorkspaceVersion {
  savedAt: number;
  groups: SavedTabGroup[];
  looseTabs: SavedTab[];
}

export interface Workspace {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  groups: SavedTabGroup[];
  looseTabs: SavedTab[];
  tags?: string[];
  pinned?: boolean;
  snoozedUntil?: number;
  /** Versioned snapshots, capped at MAX_VERSIONS (oldest dropped). */
  history?: WorkspaceVersion[];
  /** Drive file id once synced. */
  driveFileId?: string;
  /** Last known Drive headRevisionId, used for If-Match conflict detection. */
  driveRevision?: string;
}

export interface UserProfile {
  email: string;
  name?: string;
  picture?: string;
}

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error' | 'signed-out';

export interface SyncStatus {
  state: SyncState;
  lastSyncedAt?: number;
  message?: string;
}

export interface Settings {
  autoSnapshotMinutes: number; // 0 = disabled
  theme: 'system' | 'light' | 'dark';
  syncPollSeconds: number;
}

export const DEFAULT_SETTINGS: Settings = {
  autoSnapshotMinutes: 0,
  theme: 'dark',
  syncPollSeconds: 45,
};

export const MAX_VERSIONS = 10;

/** Messages sent between SW, side panel, popup. */
export type RuntimeMessage =
  | { type: 'auth/sign-in' }
  | { type: 'auth/sign-out' }
  | { type: 'auth/get-user' }
  | { type: 'workspace/capture'; name: string }
  | { type: 'workspace/restore'; id: string; replaceCurrent?: boolean }
  | { type: 'workspace/delete'; id: string }
  | { type: 'workspace/update'; workspace: Workspace }
  | { type: 'workspace/list' }
  | { type: 'sync/now' }
  | { type: 'sync/status' }
  | { type: 'snooze/schedule'; id: string; until: number }
  | { type: 'open-side-panel' };

export type RuntimeResponse<T = unknown> = { ok: true; data: T } | { ok: false; error: string };
