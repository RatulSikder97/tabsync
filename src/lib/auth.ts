/**
 * Google OAuth via chrome.identity.
 *
 * Notes on token lifecycle in MV3:
 * - getAuthToken caches a token until it expires (~1h) or we explicitly remove it.
 * - On any 401 from Google APIs, callers should removeCachedAuthToken() and retry once
 *   with interactive=false; if that also fails, surface the error so the user can re-auth.
 * - Sign-out flows must both removeCachedAuthToken AND revoke at Google's revoke endpoint;
 *   otherwise the next sign-in returns the same cached account silently.
 */
import type { UserProfile } from './types';

const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';
const PROFILE_KEY = 'tabsync.profile';

export async function getToken(interactive = false): Promise<string> {
  return await new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(new Error(chrome.runtime.lastError?.message || 'No token'));
        return;
      }
      // Older Chrome returns a string; newer returns { token, grantedScopes }.
      const t = typeof token === 'string' ? token : (token as { token: string }).token;
      resolve(t);
    });
  });
}

export async function removeCachedToken(token: string): Promise<void> {
  return await new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, () => resolve());
  });
}

/** Wraps a Google API fetch. On 401, drops cached token and retries once. */
export async function authedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  attempt = 0,
): Promise<Response> {
  const token = await getToken(false);
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(input, { ...init, headers });
  if (res.status === 401 && attempt === 0) {
    await removeCachedToken(token);
    return await authedFetch(input, init, attempt + 1);
  }
  return res;
}

export async function fetchUserProfile(): Promise<UserProfile> {
  const res = await authedFetch(USERINFO_ENDPOINT);
  if (!res.ok) throw new Error(`userinfo failed: ${res.status}`);
  const data = (await res.json()) as { email: string; name?: string; picture?: string };
  const profile: UserProfile = { email: data.email, name: data.name, picture: data.picture };
  await chrome.storage.local.set({ [PROFILE_KEY]: profile });
  return profile;
}

export async function getCachedProfile(): Promise<UserProfile | null> {
  const r = await chrome.storage.local.get(PROFILE_KEY);
  return (r[PROFILE_KEY] as UserProfile) ?? null;
}

export async function signIn(): Promise<UserProfile> {
  await getToken(true); // interactive prompt
  return await fetchUserProfile();
}

export async function signOut(): Promise<void> {
  try {
    const token = await getToken(false);
    await removeCachedToken(token);
    await fetch(`${REVOKE_ENDPOINT}?token=${token}`, { method: 'POST' });
  } catch {
    // already signed out — ignore
  }
  await chrome.storage.local.remove(PROFILE_KEY);
  // Also clear all cached identity to fully sign out.
  await new Promise<void>((resolve) =>
    chrome.identity.clearAllCachedAuthTokens(() => resolve()),
  );
}

export async function isSignedIn(): Promise<boolean> {
  try {
    await getToken(false);
    return true;
  } catch {
    return false;
  }
}
