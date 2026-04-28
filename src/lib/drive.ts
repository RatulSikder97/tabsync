/**
 * Google Drive REST v3 wrapper, scoped to the appDataFolder.
 *
 * appDataFolder is hidden from the user's normal Drive view but still counts toward quota.
 * Each TabSync workspace is one JSON file there, named "<workspace-id>.json".
 *
 * Conflict strategy:
 *   - We track the file's `headRevisionId` after every read/write.
 *   - On update we send `If-Match: <revision>` so concurrent writers get HTTP 412.
 *   - The sync engine handles 412 by pulling, archiving the remote into local history,
 *     and re-pushing with the new revision (last-write-wins, with the loser preserved).
 */
import { authedFetch } from './auth';
import { sleep, withTimeout } from './utils';

const DRIVE_ROOT = 'https://www.googleapis.com/drive/v3';
const UPLOAD_ROOT = 'https://www.googleapis.com/upload/drive/v3';
const APP_FOLDER = 'appDataFolder';
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 4;

export interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
  headRevisionId?: string;
  size?: string;
}

async function driveFetch(input: string, init: RequestInit = {}, attempt = 0): Promise<Response> {
  const res = await withTimeout(authedFetch(input, init), REQUEST_TIMEOUT_MS, 'drive');
  if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
    const backoff = Math.min(2_000 * 2 ** attempt + Math.random() * 250, 16_000);
    await sleep(backoff);
    return await driveFetch(input, init, attempt + 1);
  }
  return res;
}

export async function listAppFiles(): Promise<DriveFile[]> {
  const params = new URLSearchParams({
    spaces: APP_FOLDER,
    pageSize: '1000',
    fields: 'files(id,name,modifiedTime,headRevisionId,size)',
    q: "trashed = false",
  });
  const res = await driveFetch(`${DRIVE_ROOT}/files?${params}`);
  if (!res.ok) throw new Error(`Drive list failed: ${res.status}`);
  const data = (await res.json()) as { files: DriveFile[] };
  return data.files ?? [];
}

export async function getFileMeta(fileId: string): Promise<DriveFile> {
  const params = new URLSearchParams({ fields: 'id,name,modifiedTime,headRevisionId,size' });
  const res = await driveFetch(`${DRIVE_ROOT}/files/${fileId}?${params}`);
  if (!res.ok) throw new Error(`Drive meta failed: ${res.status}`);
  return (await res.json()) as DriveFile;
}

export async function readFile<T>(fileId: string): Promise<{ data: T; meta: DriveFile }> {
  const [content, meta] = await Promise.all([
    driveFetch(`${DRIVE_ROOT}/files/${fileId}?alt=media`),
    getFileMeta(fileId),
  ]);
  if (!content.ok) throw new Error(`Drive read failed: ${content.status}`);
  const data = (await content.json()) as T;
  return { data, meta };
}

export async function createFile<T>(name: string, body: T): Promise<DriveFile> {
  const boundary = `tabsync_${Date.now()}`;
  const metadata = { name, parents: [APP_FOLDER], mimeType: 'application/json' };
  const multipart =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    'Content-Type: application/json\r\n\r\n' +
    `${JSON.stringify(body)}\r\n` +
    `--${boundary}--`;

  const params = new URLSearchParams({
    uploadType: 'multipart',
    fields: 'id,name,modifiedTime,headRevisionId,size',
  });
  const res = await driveFetch(`${UPLOAD_ROOT}/files?${params}`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: multipart,
  });
  if (!res.ok) throw new Error(`Drive create failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as DriveFile;
}

export class DriveConflictError extends Error {
  remote: DriveFile;
  constructor(remote: DriveFile) {
    super('Drive conflict (412 Precondition Failed)');
    this.name = 'DriveConflictError';
    this.remote = remote;
  }
}

/** PATCH the file body. If `ifMatch` is provided, the API rejects stale writes with 412. */
export async function updateFile<T>(
  fileId: string,
  body: T,
  ifMatch?: string,
): Promise<DriveFile> {
  const params = new URLSearchParams({
    uploadType: 'media',
    fields: 'id,name,modifiedTime,headRevisionId,size',
  });
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (ifMatch) headers['If-Match'] = ifMatch;

  const res = await driveFetch(`${UPLOAD_ROOT}/files/${fileId}?${params}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
  if (res.status === 412) {
    const remote = await getFileMeta(fileId);
    throw new DriveConflictError(remote);
  }
  if (!res.ok) throw new Error(`Drive update failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as DriveFile;
}

export async function deleteFile(fileId: string): Promise<void> {
  const res = await driveFetch(`${DRIVE_ROOT}/files/${fileId}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Drive delete failed: ${res.status}`);
  }
}
