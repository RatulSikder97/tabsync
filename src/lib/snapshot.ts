import { MAX_VERSIONS, type Workspace, type WorkspaceVersion } from './types';

/** Push current state of a workspace into its history, capped at MAX_VERSIONS. */
export function pushVersion(ws: Workspace, snapshot?: Partial<WorkspaceVersion>): Workspace {
  const version: WorkspaceVersion = {
    savedAt: Date.now(),
    groups: snapshot?.groups ?? ws.groups,
    looseTabs: snapshot?.looseTabs ?? ws.looseTabs,
  };
  const history = [version, ...(ws.history ?? [])].slice(0, MAX_VERSIONS);
  return { ...ws, history };
}

export function restoreFromVersion(ws: Workspace, savedAt: number): Workspace | null {
  const v = ws.history?.find((h) => h.savedAt === savedAt);
  if (!v) return null;
  return { ...ws, groups: v.groups, looseTabs: v.looseTabs, updatedAt: Date.now() };
}
