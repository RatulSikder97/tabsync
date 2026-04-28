# TabSync

A Chrome extension that saves, restores, and syncs **tab-group workspaces** across devices via your Google account. Built with Manifest V3, React 18, TypeScript, Vite, Tailwind CSS, and shadcn/ui.

## What it does

- **Save workspace** — one click captures every tab group (name, color, order, urls, favicons) plus loose tabs.
- **Restore workspace** — reopens the entire window exactly as it was.
- **Auto-snapshot** — optional silent versioning every N minutes.
- **Edit / drag-and-drop reorder** tabs and groups.
- **Search** — fuzzy across workspace names, group names, tab titles, urls.
- **Pin / tag / snooze / version history** (last 10 per workspace).
- **Google sync** — workspaces stored in your Drive `appDataFolder` (hidden from your normal Drive view), synced across every device signed into the same account.
- **Offline-first** — local mutations queue and flush when you're back online; conflicts are last-write-wins with the loser preserved in version history.
- **Polish** — command palette (⌘K), quick-save popup, dark mode, keyboard-first.

## File structure

```
tabsync/
├── manifest.json                   # MV3 manifest
├── package.json · tsconfig.json · vite.config.ts · tailwind.config.ts
├── sidepanel.html · popup.html · options.html
├── src/
│   ├── background/service-worker.ts  # OAuth · alarms · sync · message router
│   ├── sidepanel/{main,App}.tsx      # Main UI
│   ├── popup/{main,Popup}.tsx        # Quick-save UI from toolbar
│   ├── options/{main,Options}.tsx    # Settings page
│   ├── lib/
│   │   ├── auth.ts                   # chrome.identity wrapper · 401 retry
│   │   ├── drive.ts                  # Drive REST · appDataFolder · If-Match
│   │   ├── sync.ts                   # bi-dir engine · queue · conflicts
│   │   ├── tabs.ts                   # capture / restore tab groups
│   │   ├── store.ts                  # Zustand + chrome.storage persistence
│   │   ├── snapshot.ts · fuzzy.ts · colors.ts · time.ts · utils.ts · messages.ts · types.ts
│   ├── components/                   # Header · WorkspaceCard · WorkspaceDetail · CommandPalette · ...
│   ├── components/ui/                # shadcn primitives
│   ├── hooks/                        # useShortcuts · useTheme
│   └── styles/globals.css
└── public/icons · public/illustrations
```

## Google Cloud Console setup (required)

To use the Drive sync you need an OAuth 2.0 Client ID for a Chrome extension.

1. Open the [Google Cloud Console](https://console.cloud.google.com/) and create (or pick) a project.
2. **Enable APIs**: APIs & Services → Library → enable **Google Drive API**.
3. **OAuth consent screen**:
   - User type: *External* (or *Internal* if you're in a Workspace).
   - App name: `TabSync`. Support email: your email.
   - Scopes: add `…/auth/userinfo.email`, `…/auth/userinfo.profile`, `…/auth/drive.appdata`.
   - Test users: add your Gmail until the app is verified.
4. **Get the extension ID** (needed for the OAuth client):
   - `npm run build` once.
   - Open `chrome://extensions`, enable Developer Mode, **Load unpacked** → pick `tabsync/dist`.
   - Copy the long ID under the extension's name.
5. **Create credentials**: APIs & Services → Credentials → Create Credentials → **OAuth client ID** → Application type **Chrome extension** → paste the extension ID.
6. **Paste the Client ID into `manifest.json`**:
   ```json
   "oauth2": {
     "client_id": "1234567890-abcdefg.apps.googleusercontent.com",
     "scopes": [ … ]
   }
   ```
7. Run `npm run build` again, reload the extension in `chrome://extensions`.

> If sign-in fails with `OAuth2 not granted or revoked`, double-check the client ID's *Authorized origins* match the extension ID and that the Drive API is enabled in the same project.

## Build & install

```bash
npm install
npm run build              # outputs dist/
# Then in chrome://extensions: Load unpacked → select tabsync/dist
```

For development with HMR on the side panel:

```bash
npm run dev                # Vite dev server
# Reload the extension in chrome://extensions after first load
```

Type-check only:

```bash
npm run typecheck
```

## Screens

- **Header** — TS logo, search input, command-palette button, primary "Save" button, sync status pill (green/amber/red), Gmail avatar dropdown, settings gear.
- **Workspace list** — responsive 1–2 column card grid. Each card shows name, group color pills (Chrome palette), loose-tab count, "updated 3m ago", hover-reveal actions: Restore / Pin / Snooze / Edit / Delete.
- **Workspace detail** — inline rename, color picker, expandable groups, drag-handle row reorder, per-tab favicon + open / remove buttons, loose-tabs section.
- **Empty state** — soft glow illustration, three-step onboarding (Sign in → Open tabs → Save), CTA button.
- **Command palette (⌘K)** — search "Actions" group (Save, Sync now, Settings) plus a "Workspaces" group with all saved workspaces.
- **Quick-save popup** — name field, primary save button, list of 5 most recent workspaces with one-click restore.
- **Options** — auto-snapshot interval, sync poll seconds, theme, JSON export/import, link to `chrome://extensions/shortcuts`.

## Architecture notes

### OAuth + Drive in MV3

`chrome.identity.getAuthToken` provides cached access tokens; the service worker is always our token source. Every Google API call goes through `lib/auth.authedFetch` which transparently retries once with `removeCachedAuthToken` on a 401. Drive calls layer exponential backoff on 429/5xx in `lib/drive.driveFetch`.

### Tab-group capture & restore

Restoring "exactly" is the trickiest piece because Chrome decouples tab IDs from group IDs. `lib/tabs.restoreWorkspace` does it in three passes: (1) open one window with a placeholder, (2) `chrome.tabs.create` every tab inactive into that window, (3) for each saved group call `chrome.tabs.group({ tabIds })` then `chrome.tabGroups.update({ title, color, collapsed })`. The placeholder is removed once real tabs exist. Loose tabs skip the grouping pass.

`chrome://`, `chrome-untrusted://`, and `javascript:` URLs are quietly replaced with `about:blank` since Chrome refuses extension creates for those.

### Conflict resolution

Each Drive workspace file tracks `headRevisionId`. Pushes use `If-Match`; on a 412 we pull the remote, push it into the local workspace's version history (capped at 10), bump `updatedAt`, and re-push. This is last-write-wins, but the loser is never silently lost.

### Offline-first

Mutations land in `chrome.storage.local` immediately and append to a small queue. The service worker drains the queue on a `chrome.alarms` tick (every poll-seconds), on the `online` event, and on demand via `sync/now`. A successful drain updates `lastSyncedAt`; the header pill turns green.

### Storage

We never use `localStorage` / `sessionStorage`. All persistence is `chrome.storage.local` (workspaces + settings + sync status + cached profile + queue). The Zustand store reflects this and listens to `chrome.storage.onChanged` so all surfaces (side panel, popup, options) stay in sync without explicit messaging.

## Known limitations

- Drag-and-drop currently lives within the workspace detail tab list; cross-group reorder works, cross-workspace drag is intentionally out of scope.
- "Add tab" inside an existing workspace's detail is stubbed — you can save/edit/delete, but there's no manual URL input yet.
- Chrome extension icons are placeholders (`public/icons/README.txt`); replace before publishing.
