/** Typed wrapper around chrome.runtime.sendMessage. */
import type { RuntimeMessage, RuntimeResponse } from './types';

export async function send<T = unknown>(msg: RuntimeMessage): Promise<T> {
  const res = (await chrome.runtime.sendMessage(msg)) as RuntimeResponse<T>;
  if (!res || res.ok === false) {
    throw new Error(res?.error ?? 'No response from background');
  }
  return res.data;
}
