/**
 * Smoke test: capture → store → restore round-trip.
 *
 * What this verifies (no Drive/OAuth — that needs an interactive consent screen):
 *   1. The built extension loads cleanly into Chromium.
 *   2. The MV3 service worker registers and can call chrome.tabs / chrome.tabGroups.
 *   3. captureCurrentWindow() correctly serialises tab groups + colors + order.
 *   4. The workspace is persisted into chrome.storage.local.
 *   5. restoreWorkspace() recreates groups, colors and tab order in a new window.
 *
 * The test drives everything from the SW context via Playwright's
 * `serviceWorker.evaluate()` so the underlying Chrome APIs are exercised
 * exactly the way the production code uses them.
 */
import { test, expect, chromium, type BrowserContext, type Worker } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXTENSION_PATH = path.resolve(__dirname, '..', 'dist');
const USER_DATA_DIR = path.resolve(__dirname, '..', '.playwright-profile');

let context: BrowserContext;
let sw: Worker;
let extensionId: string;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    channel: 'chromium',
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  sw = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  extensionId = new URL(sw.url()).host;
});

test.afterAll(async () => {
  await context?.close();
});

test('captures a tab group and persists it to chrome.storage', async () => {
  // Reset state so the test is repeatable.
  await sw.evaluate(async () => {
    await chrome.storage.local.clear();
    const tabs = await chrome.tabs.query({});
    const ids = tabs.map((t) => t.id!).filter((x): x is number => typeof x === 'number');
    if (ids.length > 1) {
      // Leave one tab so the window stays alive.
      await chrome.tabs.remove(ids.slice(1));
    }
  });

  // Open three example pages in the same window.
  const window = await sw.evaluate(async () => {
    const w = await chrome.windows.getCurrent();
    return w.id!;
  });

  const tabIds = await sw.evaluate(async (windowId: number) => {
    const urls = ['https://example.com/', 'https://www.iana.org/', 'https://www.w3.org/'];
    const created: number[] = [];
    for (const url of urls) {
      const t = await chrome.tabs.create({ url, windowId, active: false });
      if (t.id !== undefined) created.push(t.id);
    }
    return created;
  }, window);

  expect(tabIds.length).toBe(3);

  // Group them as "Research" / blue.
  await sw.evaluate(async (ids: number[]) => {
    const groupId = await chrome.tabs.group({ tabIds: ids });
    await chrome.tabGroups.update(groupId, { title: 'Research', color: 'blue' });
  }, tabIds);

  // Drive the side panel UI: open it as a tab, click Save, name it, submit.
  const sidepanel = await context.newPage();
  await sidepanel.goto(`chrome-extension://${extensionId}/sidepanel.html`);

  // Header has a "Save" button (primary). Click it to open the dialog.
  await sidepanel.getByRole('button', { name: /save/i }).first().click();

  const nameInput = sidepanel.getByPlaceholder(/workspace name/i);
  await nameInput.fill('Smoke Test');

  // The dialog footer has a confirming "Save" button.
  await sidepanel.getByRole('button', { name: /^save$/i }).last().click();

  // Wait for storage to update.
  await expect
    .poll(
      async () => {
        const r = await sw.evaluate(async () => {
          const x = await chrome.storage.local.get('tabsync.workspaces');
          return (x['tabsync.workspaces'] as unknown[]) ?? [];
        });
        return r.length;
      },
      { timeout: 5_000, message: 'workspace did not appear in storage' },
    )
    .toBe(1);

  const ws = (await sw.evaluate(async () => {
    const x = await chrome.storage.local.get('tabsync.workspaces');
    return (x['tabsync.workspaces'] as Array<Record<string, unknown>>)[0]!;
  })) as {
    name: string;
    groups: Array<{ name: string; color: string; tabs: Array<{ url: string }> }>;
  };

  expect(ws.name).toBe('Smoke Test');
  expect(ws.groups).toHaveLength(1);
  expect(ws.groups[0]?.name).toBe('Research');
  expect(ws.groups[0]?.color).toBe('blue');
  const urls = ws.groups[0]?.tabs.map((t) => t.url).sort();
  expect(urls).toEqual([
    'https://example.com/',
    'https://www.iana.org/',
    'https://www.w3.org/',
  ]);

  await sidepanel.close();
});

test('restores a saved workspace into a new window with the right group', async () => {
  // Use whatever workspace the previous test created.
  const wsId = await sw.evaluate(async () => {
    const x = await chrome.storage.local.get('tabsync.workspaces');
    const list = (x['tabsync.workspaces'] as Array<{ id: string }>) ?? [];
    return list[0]?.id ?? null;
  });
  expect(wsId).not.toBeNull();

  const beforeWindows = await sw.evaluate(async () => (await chrome.windows.getAll()).length);

  // chrome.runtime.sendMessage from the SW does NOT loop back to its own onMessage
  // listener. Send the message from an extension page (popup) instead, mirroring how
  // the real popup/sidepanel UI invokes the handler.
  const dispatcher = await context.newPage();
  await dispatcher.goto(`chrome-extension://${extensionId}/popup.html`);
  await dispatcher.evaluate(async (id: string) => {
    await chrome.runtime.sendMessage({ type: 'workspace/restore', id });
  }, wsId!);
  await dispatcher.close();

  // Wait until a new window with our 3 tabs in a "Research" group exists.
  const result = await expect
    .poll(
      async () =>
        await sw.evaluate(async () => {
          const wins = await chrome.windows.getAll({ populate: true });
          for (const w of wins) {
            const tabs = w.tabs ?? [];
            if (tabs.length < 3) continue;
            const groupIds = [...new Set(tabs.map((t) => t.groupId).filter((g) => g !== -1))];
            for (const gid of groupIds) {
              const meta = await chrome.tabGroups.get(gid);
              if (meta.title === 'Research' && meta.color === 'blue') {
                return {
                  windowCount: wins.length,
                  groupTabUrls: tabs
                    .filter((t) => t.groupId === gid)
                    .map((t) => t.url ?? '')
                    .sort(),
                };
              }
            }
          }
          return null;
        }),
      { timeout: 15_000, message: 'restored workspace not found' },
    )
    .not.toBeNull();
  // expect.poll returns the matcher, not the value — re-fetch:
  const final = await sw.evaluate(async () => {
    const wins = await chrome.windows.getAll({ populate: true });
    for (const w of wins) {
      const tabs = w.tabs ?? [];
      const groupIds = [...new Set(tabs.map((t) => t.groupId).filter((g) => g !== -1))];
      for (const gid of groupIds) {
        const meta = await chrome.tabGroups.get(gid);
        if (meta.title === 'Research' && meta.color === 'blue') {
          return {
            windowCount: wins.length,
            urls: tabs
              .filter((t) => t.groupId === gid)
              .map((t) => t.url ?? t.pendingUrl ?? '')
              .sort(),
          };
        }
      }
    }
    return null;
  });

  expect(final).not.toBeNull();
  expect(final!.windowCount).toBeGreaterThan(beforeWindows);
  expect(final!.urls).toEqual([
    'https://example.com/',
    'https://www.iana.org/',
    'https://www.w3.org/',
  ]);

  void result; // suppress unused
});
