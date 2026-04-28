import { Command as CMDK } from 'cmdk';
import { Cloud, RotateCcw, Save, Search as SearchIcon, Settings, MoonStar } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useStore } from '@/lib/store';
import { send } from '@/lib/messages';
import type { Workspace } from '@/lib/types';
import { toast } from 'sonner';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: () => void;
  onOpenWorkspace: (ws: Workspace) => void;
}

export function CommandPalette({ open, onOpenChange, onCapture, onOpenWorkspace }: CommandPaletteProps) {
  const workspaces = useStore((s) => s.workspaces);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0">
        <VisuallyHidden asChild>
          <DialogTitle>Command palette</DialogTitle>
        </VisuallyHidden>
        <VisuallyHidden asChild>
          <DialogDescription>Quickly run commands and jump to workspaces.</DialogDescription>
        </VisuallyHidden>

        <CMDK label="Command palette" className="flex flex-col">
          <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
            <SearchIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <CMDK.Input
              placeholder="Type a command or search workspaces…"
              className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
          </div>
          <CMDK.List className="max-h-[360px] overflow-auto p-1">
            <CMDK.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
              No matches.
            </CMDK.Empty>

            <CMDK.Group heading="Actions" className="px-1 py-1 text-[11px] uppercase tracking-wider text-muted-foreground">
              <CommandItem
                icon={<Save className="h-3.5 w-3.5" />}
                label="Save current window"
                shortcut="⌘S"
                onSelect={() => {
                  onOpenChange(false);
                  onCapture();
                }}
              />
              <CommandItem
                icon={<Cloud className="h-3.5 w-3.5" />}
                label="Sync now"
                onSelect={async () => {
                  onOpenChange(false);
                  try {
                    await send({ type: 'sync/now' });
                    toast.success('Synced');
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Sync failed');
                  }
                }}
              />
              <CommandItem
                icon={<Settings className="h-3.5 w-3.5" />}
                label="Open settings"
                onSelect={() => {
                  onOpenChange(false);
                  chrome.runtime.openOptionsPage();
                }}
              />
            </CMDK.Group>

            {workspaces.length > 0 && (
              <CMDK.Group heading="Workspaces" className="px-1 py-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                {workspaces.slice(0, 50).map((w) => (
                  <CMDK.Item
                    key={w.id}
                    value={`${w.name} ${w.tags?.join(' ') ?? ''}`}
                    onSelect={() => {
                      onOpenChange(false);
                      onOpenWorkspace(w);
                    }}
                    className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm aria-selected:bg-accent"
                  >
                    {w.snoozedUntil ? (
                      <MoonStar className="h-3.5 w-3.5 text-amber-400" />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5 text-primary" />
                    )}
                    <span className="flex-1 truncate">{w.name}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {w.groups.reduce((n, g) => n + g.tabs.length, 0) + w.looseTabs.length} tabs
                    </span>
                  </CMDK.Item>
                ))}
              </CMDK.Group>
            )}
          </CMDK.List>
        </CMDK>
      </DialogContent>
    </Dialog>
  );
}

function CommandItem({
  icon,
  label,
  onSelect,
  shortcut,
}: {
  icon: React.ReactNode;
  label: string;
  onSelect: () => void;
  shortcut?: string;
}) {
  return (
    <CMDK.Item
      onSelect={onSelect}
      value={label}
      className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm aria-selected:bg-accent"
    >
      {icon}
      <span className="flex-1">{label}</span>
      {shortcut && <span className="font-mono text-[10px] text-muted-foreground">{shortcut}</span>}
    </CMDK.Item>
  );
}
