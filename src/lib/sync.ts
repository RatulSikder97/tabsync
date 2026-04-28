/**
 * Bidirectional sync engine: local chrome.storage.local <-> Drive appDataFolder.
 *
 * One Drive file per workspace, named `<workspace-id>.json`. Each file contains the
 * full Workspace object including its history.
 *
 * Conflict resolution (last-write-wins, loser preserved):
 *   - Each local workspace tracks { driveFileId, driveRevision }.
 *   - On push we PATCH with If-Match: driveRevision.
 *   - On 412 conflict: pull remote, prepend remote state into local history,
 *     then push local with the new revision and an updated `updatedAt`.
 *
 * Offline queue:
 *   - Mutations flag the workspace as `dirty` in the local mutation queue.
 *   - The SW retries the queue on alarms, on `online` events, and after sign-in.
 */
import {
  createFile,
  deleteFile,
  DriveConflictError,
  type DriveFile,
  listAppFiles,
  readFile,
  updateFile,
} from './drive';
import { isSignedIn } from './auth';
import { pushVersion } from './snapshot';
import { STORAGE_KEYS, useStore } from './store';
import type { SyncStatus, Workspace, WorkspaceVersion } from './types';

const QUEUE_KEY = 'tabsync.queue';

interface QueueEntry {
  op: 'upsert' | 'delete';
  workspaceId: string;
}

async function readQueue(): Promise<QueueEntry[]> {
  const r = await chrome.storage.local.get(QUEUE_KEY);
  return (r[QUEUE_KEY] as QueueEntry[]) ?? [];
}

async function writeQueue(q: QueueEntry[]): Promise<void> {
  await chrome.storage.local.set({ [QUEUE_KEY]: q });
}

async function enqueue(entry: QueueEntry): Promise<void> {
  const q = await readQueue();
  // Dedupe: only keep latest op per workspaceId.
  const filtered = q.filter((e) => e.workspaceId !== entry.workspaceId);
  filtered.push(entry);
  await writeQueue(filtered);
}

async function setStatus(s: SyncStatus): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.sync]: s });
}

/** Public: queue a workspace upsert and trigger a flush. */
export async function queueUpsert(ws: Workspace): Promise<void> {
  const store = useStore.getState();
  await store.upsertLocal(ws);
  await enqueue({ op: 'upsert', workspaceId: ws.id });
  void flush();
}

/** Public: queue a workspace deletion and trigger a flush. */
export async function queueDelete(workspaceId: string): Promise<void> {
  const store = useStore.getState();
  await store.removeLocal(workspaceId);
  await enqueue({ op: 'delete', workspaceId });
  void flush();
}

/** Push a single workspace to Drive, handling create-vs-update and conflicts. */
async function pushWorkspace(ws: Workspace): Promise<Workspace> {
  if (!ws.driveFileId) {
    const file = await createFile(`${ws.id}.json`, ws);
    return { ...ws, driveFileId: file.id, driveRevision: file.headRevisionId };
  }
  try {
    const file = await updateFile(ws.driveFileId, ws, ws.driveRevision);
    return { ...ws, driveRevision: file.headRevisionId };
  } catch (err) {
    if (err instanceof DriveConflictError) {
      const { data: remote } = await readFile<Workspace>(ws.driveFileId);
      const remoteVersion: WorkspaceVersion = {
        savedAt: remote.updatedAt,
        groups: remote.groups,
        looseTabs: remote.looseTabs,
      };
      const merged = pushVersion(
        { ...ws, updatedAt: Math.max(ws.updatedAt, remote.updatedAt) + 1 },
        remoteVersion,
      );
      // Re-fetch revision and try once more without If-Match (we now own latest).
      const file = await updateFile(merged.driveFileId!, merged);
      return { ...merged, driveRevision: file.headRevisionId };
    }
    throw err;
  }
}

/** Drain the queue. Idempotent. */
export async function flush(): Promise<void> {
  if (!(await isSignedIn())) {
    await setStatus({ state: 'signed-out' });
    return;
  }
  if (!navigator.onLine) {
    await setStatus({ state: 'offline' });
    return;
  }

  const q = await readQueue();
  if (q.length === 0) {
    await setStatus({ state: 'idle', lastSyncedAt: Date.now() });
    return;
  }

  await setStatus({ state: 'syncing' });
  const store = useStore.getState();
  const remaining: QueueEntry[] = [];

  for (const entry of q) {
    try {
      if (entry.op === 'delete') {
        const ws = store.workspaces.find((w) => w.id === entry.workspaceId);
        if (ws?.driveFileId) await deleteFile(ws.driveFileId);
      } else {
        const ws = useStore.getState().workspaces.find((w) => w.id === entry.workspaceId);
        if (!ws) continue;
        const updated = await pushWorkspace(ws);
        await store.upsertLocal(updated);
      }
    } catch (err) {
      console.warn('[sync] entry failed, will retry', entry, err);
      remaining.push(entry);
    }
  }

  await writeQueue(remaining);

  if (remaining.length > 0) {
    await setStatus({
      state: 'error',
      message: `${remaining.length} pending`,
      lastSyncedAt: Date.now(),
    });
  } else {
    await setStatus({ state: 'idle', lastSyncedAt: Date.now() });
  }
}

/** Pull remote files; merge into local store using updatedAt as tiebreaker. */
export async function pullAll(): Promise<void> {
  if (!(await isSignedIn())) {
    await setStatus({ state: 'signed-out' });
    return;
  }
  if (!navigator.onLine) {
    await setStatus({ state: 'offline' });
    return;
  }

  await setStatus({ state: 'syncing' });
  const store = useStore.getState();
  try {
    const files = await listAppFiles();
    const localById = new Map(store.workspaces.map((w) => [w.id, w] as const));
    const remoteIds = new Set<string>();

    for (const f of files) {
      const id = stripJsonExt(f.name);
      if (!id) continue;
      remoteIds.add(id);
      const local = localById.get(id);
      const localRev = local?.driveRevision;
      if (local && localRev === f.headRevisionId) continue; // up-to-date

      const { data: remote, meta } = await readFile<Workspace>(f.id);
      const next: Workspace = local && local.updatedAt > remote.updatedAt
        ? // Local is newer — keep local but record current Drive revision so push uses fresh If-Match.
          { ...local, driveFileId: f.id, driveRevision: meta.headRevisionId }
        : // Remote is newer or equal — adopt remote.
          { ...remote, driveFileId: f.id, driveRevision: meta.headRevisionId };
      await store.upsertLocal(next);
    }

    // Tombstone: remove local workspaces whose Drive file no longer exists AND were synced before.
    for (const ws of store.workspaces) {
      if (ws.driveFileId && !remoteIds.has(ws.id)) {
        await store.removeLocal(ws.id);
      }
    }

    await setStatus({ state: 'idle', lastSyncedAt: Date.now() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await setStatus({ state: 'error', message: msg, lastSyncedAt: Date.now() });
    throw err;
  }
}

/** Run a full reconciliation: pull, then flush. Safe to call repeatedly. */
export async function syncNow(): Promise<void> {
  await pullAll();
  await flush();
}

function stripJsonExt(name: string): string | null {
  return name.endsWith('.json') ? name.slice(0, -5) : null;
}

/** Helper for inspecting just the meta — used by tests / debug surfaces. */
export type { DriveFile };
