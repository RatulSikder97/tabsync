/**
 * MV3 service worker.
 *
 * Responsibilities:
 *   - OAuth orchestration (sign-in / sign-out / get profile).
 *   - Tab capture / restore (delegated to lib/tabs).
 *   - Sync reconciliation on alarms, online events, and on demand.
 *   - Notifications when snoozed workspaces resurface.
 *   - Side panel + commands wiring.
 *
 * The SW is event-driven and may be terminated at any time; all persistent
 * state lives in chrome.storage.local. Keep top-level logic side-effect-free
 * apart from listener registration.
 */
import { fetchUserProfile, isSignedIn, signIn, signOut } from '@/lib/auth';
import { send as _unused } from '@/lib/messages'; // re-export not needed here
import { useStore } from '@/lib/store';
import { captureCurrentWindow, restoreWorkspace } from '@/lib/tabs';
import type { RuntimeMessage, RuntimeResponse, Workspace } from '@/lib/types';
import { flush, pullAll, queueDelete, queueUpsert, syncNow } from '@/lib/sync';

const SYNC_ALARM = 'tabsync.sync';
const SNOOZE_PREFIX = 'tabsync.snooze.';
const AUTOSNAP_ALARM = 'tabsync.autosnap';
void _unused; // silence unused import

// --- Lifecycle ----------------------------------------------------------------

chrome.runtime.onInstalled.addListener(async () => {
  await useStore.getState().hydrate();
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
  await reschedule();
});

chrome.runtime.onStartup.addListener(async () => {
  await useStore.getState().hydrate();
  await reschedule();
  void syncNow().catch(() => {});
});

async function reschedule(): Promise<void> {
  await useStore.getState().hydrate();
  const { syncPollSeconds, autoSnapshotMinutes } = useStore.getState().settings;
  const periodMinutes = Math.max(0.5, syncPollSeconds / 60);
  await chrome.alarms.create(SYNC_ALARM, { periodInMinutes: periodMinutes });
  if (autoSnapshotMinutes > 0) {
    await chrome.alarms.create(AUTOSNAP_ALARM, { periodInMinutes: autoSnapshotMinutes });
  } else {
    await chrome.alarms.clear(AUTOSNAP_ALARM);
  }
}

// --- Alarms -------------------------------------------------------------------

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === SYNC_ALARM) {
    void flush().catch(() => {});
    return;
  }
  if (alarm.name === AUTOSNAP_ALARM) {
    await autoSnapshot();
    return;
  }
  if (alarm.name.startsWith(SNOOZE_PREFIX)) {
    const id = alarm.name.slice(SNOOZE_PREFIX.length);
    await onSnoozeFired(id);
  }
});

async function autoSnapshot(): Promise<void> {
  try {
    const ws = await captureCurrentWindow(`Auto-snapshot ${new Date().toLocaleString()}`);
    ws.tags = ['auto'];
    await queueUpsert(ws);
  } catch (err) {
    console.warn('[autoSnapshot] failed', err);
  }
}

async function onSnoozeFired(id: string): Promise<void> {
  const ws = useStore.getState().workspaces.find((w) => w.id === id);
  if (!ws) return;
  const updated: Workspace = { ...ws, snoozedUntil: undefined, updatedAt: Date.now() };
  await queueUpsert(updated);
  await chrome.notifications.create(`tabsync.${id}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('public/icons/128.png'),
    title: 'TabSync',
    message: `Workspace "${ws.name}" is back from snooze.`,
    priority: 1,
  });
}

// --- Network -----------------------------------------------------------------

self.addEventListener('online', () => void flush().catch(() => {}));
self.addEventListener('offline', () => {});

// --- Commands ----------------------------------------------------------------

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'open-side-panel') {
    const win = await chrome.windows.getCurrent();
    if (win.id !== undefined) await chrome.sidePanel.open({ windowId: win.id });
    return;
  }
  if (command === 'restore-last') {
    const list = useStore.getState().workspaces;
    if (!list.length) return;
    const last = [...list].sort((a, b) => b.updatedAt - a.updatedAt)[0]!;
    await restoreWorkspace(last);
  }
});

// --- Message router ----------------------------------------------------------

chrome.runtime.onMessage.addListener((msg: RuntimeMessage, _sender, sendResponse) => {
  void handle(msg)
    .then((data) => sendResponse({ ok: true, data } as RuntimeResponse))
    .catch((err: Error) => sendResponse({ ok: false, error: err.message } as RuntimeResponse));
  return true; // async
});

async function handle(msg: RuntimeMessage): Promise<unknown> {
  await useStore.getState().hydrate();

  switch (msg.type) {
    case 'auth/sign-in': {
      const profile = await signIn();
      void syncNow().catch(() => {});
      return profile;
    }
    case 'auth/sign-out': {
      await signOut();
      return null;
    }
    case 'auth/get-user': {
      if (!(await isSignedIn())) return null;
      try {
        return await fetchUserProfile();
      } catch {
        return null;
      }
    }
    case 'workspace/capture': {
      const ws = await captureCurrentWindow(msg.name);
      await queueUpsert(ws);
      return ws;
    }
    case 'workspace/restore': {
      const ws = useStore.getState().workspaces.find((w) => w.id === msg.id);
      if (!ws) throw new Error('Workspace not found');
      await restoreWorkspace(ws, { newWindow: !msg.replaceCurrent });
      return null;
    }
    case 'workspace/delete': {
      await queueDelete(msg.id);
      return null;
    }
    case 'workspace/update': {
      await queueUpsert({ ...msg.workspace, updatedAt: Date.now() });
      return null;
    }
    case 'workspace/list': {
      return useStore.getState().workspaces;
    }
    case 'sync/now': {
      await syncNow();
      return null;
    }
    case 'sync/status': {
      return useStore.getState().sync;
    }
    case 'snooze/schedule': {
      const ws = useStore.getState().workspaces.find((w) => w.id === msg.id);
      if (!ws) throw new Error('Workspace not found');
      await queueUpsert({ ...ws, snoozedUntil: msg.until });
      await chrome.alarms.create(`${SNOOZE_PREFIX}${msg.id}`, { when: msg.until });
      return null;
    }
    case 'open-side-panel': {
      const win = await chrome.windows.getCurrent();
      if (win.id !== undefined) await chrome.sidePanel.open({ windowId: win.id });
      return null;
    }
  }
}

// --- Settings change watcher --------------------------------------------------

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes['tabsync.settings']) {
    void reschedule();
  }
});

// Pull once on cold start.
void (async () => {
  await useStore.getState().hydrate();
  if (await isSignedIn()) void pullAll().catch(() => {});
})();
