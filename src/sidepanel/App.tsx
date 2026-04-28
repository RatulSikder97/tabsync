import { useEffect, useMemo, useState } from 'react';
import { Toaster, toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Header } from '@/components/Header';
import { WorkspaceCard } from '@/components/WorkspaceCard';
import { WorkspaceDetail } from '@/components/WorkspaceDetail';
import { CommandPalette } from '@/components/CommandPalette';
import { EmptyState } from '@/components/EmptyState';
import { HelpModal } from '@/components/HelpModal';
import { SaveDialog } from '@/components/SaveDialog';
import { SnoozeDialog } from '@/components/SnoozeDialog';
import { useStore } from '@/lib/store';
import { useTheme } from '@/hooks/useTheme';
import { useShortcuts } from '@/hooks/useShortcuts';
import { send } from '@/lib/messages';
import { searchWorkspaces } from '@/lib/fuzzy';
import type { Workspace } from '@/lib/types';

export function App() {
  useTheme();
  const hydrate = useStore((s) => s.hydrate);
  const hydrated = useStore((s) => s.hydrated);
  const workspaces = useStore((s) => s.workspaces);

  const [query, setQuery] = useState('');
  const [palette, setPalette] = useState(false);
  const [help, setHelp] = useState(false);
  const [save, setSave] = useState(false);
  const [editing, setEditing] = useState<Workspace | null>(null);
  const [snoozing, setSnoozing] = useState<Workspace | null>(null);

  useEffect(() => {
    void hydrate();
    void send({ type: 'auth/get-user' }).catch(() => null);
    void send({ type: 'sync/now' }).catch(() => null);
  }, [hydrate]);

  useShortcuts({
    onPalette: () => setPalette(true),
    onSave: () => setSave(true),
    onHelp: () => setHelp(true),
    onFocusSearch: () => document.querySelector<HTMLInputElement>('[aria-label="Search workspaces"]')?.focus(),
  });

  const sorted = useMemo(() => {
    const list = [...workspaces].sort((a, b) => {
      if (!!b.pinned !== !!a.pinned) return Number(!!b.pinned) - Number(!!a.pinned);
      return b.updatedAt - a.updatedAt;
    });
    if (!query.trim()) return list;
    return searchWorkspaces(list, query).map((h) => h.workspace);
  }, [workspaces, query]);

  const restore = async (ws: Workspace) => {
    try {
      await send({ type: 'workspace/restore', id: ws.id });
      toast.success(`Restored "${ws.name}"`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Restore failed');
    }
  };

  const remove = async (ws: Workspace) => {
    const prev = workspaces;
    try {
      await send({ type: 'workspace/delete', id: ws.id });
      toast(`Deleted "${ws.name}"`, {
        action: {
          label: 'Undo',
          onClick: async () => {
            // Undo: re-upsert prior snapshot (in-memory only, will resync to Drive on next push).
            await send({ type: 'workspace/update', workspace: prev.find((w) => w.id === ws.id) ?? ws });
          },
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const togglePin = async (ws: Workspace) => {
    await send({ type: 'workspace/update', workspace: { ...ws, pinned: !ws.pinned } });
  };

  if (!hydrated) {
    return (
      <div className="grid h-full place-items-center text-sm text-muted-foreground">Loading…</div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-full flex-col overflow-hidden">
        <Header
          query={query}
          onQueryChange={setQuery}
          onOpenPalette={() => setPalette(true)}
          onSave={() => setSave(true)}
        />

        {editing ? (
          <WorkspaceDetail
            workspace={editing}
            onUpdate={async (next) => {
              await send({ type: 'workspace/update', workspace: next });
              toast.success('Saved changes');
            }}
            onClose={() => setEditing(null)}
          />
        ) : sorted.length === 0 ? (
          <EmptyState onSave={() => setSave(true)} />
        ) : (
          <motion.main
            layout
            className="flex flex-1 flex-col gap-1 overflow-auto p-1.5"
          >
            <AnimatePresence mode="popLayout">
              {sorted.map((w, i) => (
                <WorkspaceCard
                  key={w.id}
                  index={i}
                  workspace={w}
                  onRestore={() => restore(w)}
                  onEdit={() => setEditing(w)}
                  onDelete={() => remove(w)}
                  onTogglePin={() => togglePin(w)}
                  onSnooze={() => setSnoozing(w)}
                />
              ))}
            </AnimatePresence>
          </motion.main>
        )}
      </div>

      <CommandPalette
        open={palette}
        onOpenChange={setPalette}
        onCapture={() => setSave(true)}
        onOpenWorkspace={(w) => setEditing(w)}
      />
      <HelpModal open={help} onOpenChange={setHelp} />
      <SaveDialog open={save} onOpenChange={setSave} />
      <SnoozeDialog workspace={snoozing} open={!!snoozing} onOpenChange={(v) => !v && setSnoozing(null)} />
      <Toaster position="bottom-right" theme="dark" richColors closeButton />
    </TooltipProvider>
  );
}
