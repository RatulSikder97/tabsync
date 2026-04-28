import type { TabGroupColor } from './types';

/** Display hex for the Chrome native palette. Used for pills and previews. */
export const COLOR_HEX: Record<TabGroupColor, string> = {
  grey: '#9aa0a6',
  blue: '#1a73e8',
  red: '#d93025',
  yellow: '#f9ab00',
  green: '#188038',
  pink: '#d01884',
  purple: '#9334e6',
  cyan: '#007b83',
  orange: '#fa7b17',
};

/** chrome.tabGroups.ColorEnum is identical to our internal palette — kept as a function
 *  so a future renaming or alias mapping has a single touchpoint. */
export function toChromeColor(c: TabGroupColor): chrome.tabGroups.ColorEnum {
  return c;
}

export function fromChromeColor(c: chrome.tabGroups.ColorEnum): TabGroupColor {
  return c as TabGroupColor;
}
