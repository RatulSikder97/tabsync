import Fuse from 'fuse.js';
import type { Workspace } from './types';

export interface SearchHit {
  workspace: Workspace;
  score: number;
}

const KEYS = [
  { name: 'name', weight: 0.5 },
  { name: 'tags', weight: 0.15 },
  { name: 'groups.name', weight: 0.15 },
  { name: 'groups.tabs.title', weight: 0.1 },
  { name: 'groups.tabs.url', weight: 0.05 },
  { name: 'looseTabs.title', weight: 0.03 },
  { name: 'looseTabs.url', weight: 0.02 },
];

export function searchWorkspaces(workspaces: Workspace[], q: string): SearchHit[] {
  const query = q.trim();
  if (!query) return workspaces.map((w) => ({ workspace: w, score: 0 }));
  const fuse = new Fuse(workspaces, {
    keys: KEYS,
    threshold: 0.4,
    ignoreLocation: true,
    includeScore: true,
  });
  return fuse.search(query).map((r) => ({ workspace: r.item, score: r.score ?? 0 }));
}
