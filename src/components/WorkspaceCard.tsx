import { Pin, RotateCcw, Trash2, Pencil, MoonStar } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { GroupPill } from './GroupPill';
import { relativeTime } from '@/lib/time';
import type { Workspace } from '@/lib/types';
import { cn } from '@/lib/utils';

interface WorkspaceCardProps {
  workspace: Workspace;
  index: number;
  onRestore: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onSnooze: () => void;
}

const SPRING = { type: 'spring' as const, stiffness: 360, damping: 30, mass: 0.55 };

export function WorkspaceCard({
  workspace,
  index,
  onRestore,
  onEdit,
  onDelete,
  onTogglePin,
  onSnooze,
}: WorkspaceCardProps) {
  const totalTabs = workspace.groups.reduce((n, g) => n + g.tabs.length, 0) + workspace.looseTabs.length;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.1 } }}
      transition={{ ...SPRING, delay: Math.min(index * 0.018, 0.18) }}
      className={cn(
        'card-hover group relative flex items-center gap-2 rounded-md border border-border/50 bg-card/90 px-2 py-1.5',
        'transition-colors hover:border-border hover:bg-card',
      )}
    >
      {/* Color glyph */}
      <div className="relative flex h-7 w-7 shrink-0 items-center justify-center">
        {workspace.groups.length > 0 ? (
          <div className="grid grid-cols-2 gap-[2px]">
            {workspace.groups.slice(0, 4).map((g, i) => (
              <span
                key={g.id + i}
                className="h-[5px] w-[5px] rounded-full"
                style={{ background: SWATCH_HEX[g.color] ?? '#7C7AED' }}
              />
            ))}
          </div>
        ) : (
          <div className="h-2 w-2 rounded-full bg-muted" />
        )}
      </div>

      {/* Title + meta */}
      <div className="min-w-0 flex-1">
        <button
          onClick={onEdit}
          className="block w-full truncate text-left text-[12px] font-medium leading-tight focus:outline-none"
          title={workspace.name}
        >
          {workspace.name}
        </button>
        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span>{totalTabs} tabs</span>
          <span>·</span>
          <span>{relativeTime(workspace.updatedAt)}</span>
          {workspace.groups.length > 0 && (
            <span className="hidden items-center gap-1 sm:inline-flex">
              ·
              {workspace.groups.slice(0, 3).map((g) => (
                <GroupPill key={g.id} color={g.color} count={g.tabs.length} />
              ))}
            </span>
          )}
          {workspace.snoozedUntil && (
            <span className="inline-flex items-center gap-0.5 text-amber-400">
              <MoonStar className="h-2.5 w-2.5" />
            </span>
          )}
          {workspace.pinned && <Pin className="h-2.5 w-2.5 text-primary" />}
        </div>
      </div>

      {/* Actions (hover) */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <Button variant="default" size="sm" className="h-6 gap-1 px-2 text-[10px]" onClick={onRestore}>
          <RotateCcw className="h-2.5 w-2.5" /> Open
        </Button>
        <IconBtn label="Pin" onClick={onTogglePin}><Pin className="h-3 w-3" /></IconBtn>
        <IconBtn label="Snooze" onClick={onSnooze}><MoonStar className="h-3 w-3" /></IconBtn>
        <IconBtn label="Edit" onClick={onEdit}><Pencil className="h-3 w-3" /></IconBtn>
        <IconBtn label="Delete" onClick={onDelete}><Trash2 className="h-3 w-3" /></IconBtn>
      </div>
    </motion.article>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button variant="ghost" size="icon" className="h-6 w-6" aria-label={label} onClick={onClick}>
      {children}
    </Button>
  );
}

const SWATCH_HEX: Record<string, string> = {
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
