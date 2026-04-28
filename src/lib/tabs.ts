/**
 * Capture and restore Chrome tab groups + loose tabs.
 *
 * Restore strategy (the tricky bit):
 *   1. Open one new window with about:blank as a placeholder so we have a windowId.
 *   2. Create every tab via chrome.tabs.create({ active:false, windowId }).
 *      Inactive=false would steal focus on each create; inactive avoids that.
 *   3. Close the placeholder once a real tab exists.
 *   4. For each saved group, call chrome.tabs.group({ tabIds, createProperties:{ windowId } })
 *      to create the group, then chrome.tabGroups.update(groupId, { title, color, collapsed })
 *      in a second pass — group/title can't be set in one API call.
 *   5. Loose tabs are simply ungrouped (default).
 */
import { fromChromeColor, toChromeColor } from './colors';
import type { SavedTab, SavedTabGroup, Workspace } from './types';
import { uid } from './utils';

const PLACEHOLDER_URL = 'about:blank';

export async function captureCurrentWindow(name: string): Promise<Workspace> {
  const win = await chrome.windows.getCurrent({ populate: true });
  const tabs = (win.tabs ?? []).filter((t) => !!t.url && !t.url.startsWith('chrome://newtab'));

  // Group tabs by groupId.
  const byGroup = new Map<number, chrome.tabs.Tab[]>();
  for (const t of tabs) {
    const g = t.groupId ?? -1;
    const arr = byGroup.get(g) ?? [];
    arr.push(t);
    byGroup.set(g, arr);
  }

  const looseTabs: SavedTab[] = (byGroup.get(-1) ?? []).map(toSavedTab);

  const groupIds = [...byGroup.keys()].filter((g) => g !== -1);
  const groupMetas = await Promise.all(groupIds.map((id) => chrome.tabGroups.get(id)));

  const groups: SavedTabGroup[] = groupMetas.map((meta) => {
    const groupTabs = byGroup.get(meta.id) ?? [];
    return {
      id: uid(),
      name: meta.title ?? 'Untitled group',
      color: fromChromeColor(meta.color),
      collapsed: meta.collapsed,
      tabs: groupTabs.map(toSavedTab),
    };
  });

  const now = Date.now();
  return {
    id: uid(),
    name: name.trim() || 'Untitled workspace',
    createdAt: now,
    updatedAt: now,
    groups,
    looseTabs,
  };
}

function toSavedTab(t: chrome.tabs.Tab): SavedTab {
  return {
    url: t.url ?? t.pendingUrl ?? '',
    title: t.title ?? '',
    favIconUrl: t.favIconUrl,
    pinned: t.pinned,
  };
}

export interface RestoreOptions {
  /** Open in a new window (default true). When false, restores into the active window. */
  newWindow?: boolean;
}

export async function restoreWorkspace(ws: Workspace, opts: RestoreOptions = {}): Promise<void> {
  const newWindow = opts.newWindow ?? true;

  // 1) Establish a window with a placeholder so we can create tabs into it.
  let windowId: number;
  let placeholderId: number | undefined;

  if (newWindow) {
    const win = await chrome.windows.create({ url: PLACEHOLDER_URL, focused: true });
    windowId = win.id!;
    placeholderId = win.tabs?.[0]?.id;
  } else {
    const win = await chrome.windows.getCurrent();
    windowId = win.id!;
  }

  // 2) Create all tabs (groups first to keep ordering stable, then loose).
  const groupTabIds: { groupName: string; color: SavedTabGroup['color']; collapsed: boolean | undefined; tabIds: number[] }[] = [];

  for (const g of ws.groups) {
    const ids: number[] = [];
    for (const tab of g.tabs) {
      const safeUrl = sanitizeUrl(tab.url);
      const created = await chrome.tabs.create({
        url: safeUrl,
        windowId,
        active: false,
        pinned: tab.pinned,
      });
      if (created.id !== undefined) ids.push(created.id);
    }
    groupTabIds.push({ groupName: g.name, color: g.color, collapsed: g.collapsed, tabIds: ids });
  }

  for (const tab of ws.looseTabs) {
    await chrome.tabs.create({
      url: sanitizeUrl(tab.url),
      windowId,
      active: false,
      pinned: tab.pinned,
    });
  }

  // 3) Drop the placeholder now that real tabs exist.
  if (placeholderId !== undefined) {
    try {
      await chrome.tabs.remove(placeholderId);
    } catch {
      /* tab may already be gone */
    }
  }

  // 4) Group + style.
  for (const g of groupTabIds) {
    if (g.tabIds.length === 0) continue;
    const groupId = await chrome.tabs.group({ tabIds: g.tabIds, createProperties: { windowId } });
    await chrome.tabGroups.update(groupId, {
      title: g.groupName,
      color: toChromeColor(g.color),
      collapsed: g.collapsed ?? false,
    });
  }
}

/**
 * Chrome refuses to create tabs with chrome:// or javascript: URLs from extensions.
 * Replace with a friendly placeholder so the rest of the workspace still restores.
 */
function sanitizeUrl(url: string): string {
  if (!url) return PLACEHOLDER_URL;
  const lower = url.toLowerCase();
  if (lower.startsWith('chrome://') || lower.startsWith('chrome-untrusted://') || lower.startsWith('javascript:')) {
    return PLACEHOLDER_URL;
  }
  return url;
}

/**
 * Returns a similarity ratio in [0,1] for duplicate-guard warnings before saving.
 * Compares URL multisets (order-insensitive). 1.0 means identical sets.
 */
export function similarity(a: Workspace, b: Workspace): number {
  const aUrls = new Set([...a.groups.flatMap((g) => g.tabs.map((t) => t.url)), ...a.looseTabs.map((t) => t.url)]);
  const bUrls = new Set([...b.groups.flatMap((g) => g.tabs.map((t) => t.url)), ...b.looseTabs.map((t) => t.url)]);
  if (aUrls.size === 0 && bUrls.size === 0) return 1;
  let intersection = 0;
  for (const u of aUrls) if (bUrls.has(u)) intersection += 1;
  const union = aUrls.size + bUrls.size - intersection;
  return union === 0 ? 1 : intersection / union;
}
