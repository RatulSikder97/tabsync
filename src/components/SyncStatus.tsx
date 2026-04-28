import { Cloud, CloudOff, Loader2, AlertTriangle, LogIn } from 'lucide-react';
import { motion } from 'framer-motion';
import { useStore } from '@/lib/store';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { relativeTime } from '@/lib/time';
import { cn } from '@/lib/utils';

const TONE: Record<string, string> = {
  idle: 'text-emerald-400',
  syncing: 'text-amber-400',
  offline: 'text-zinc-400',
  error: 'text-red-400',
  'signed-out': 'text-zinc-500',
};

export function SyncStatus() {
  const sync = useStore((s) => s.sync);
  const Icon = pickIcon(sync.state);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button
          whileTap={{ scale: 0.94 }}
          whileHover={{ y: -1 }}
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] hover:bg-accent',
            TONE[sync.state],
          )}
        >
          <span className={cn('relative inline-flex', sync.state === 'idle' && 'pulse-dot')}>
            <Icon className={cn('h-3 w-3', sync.state === 'syncing' && 'animate-spin')} />
          </span>
        </motion.button>
      </TooltipTrigger>
      <TooltipContent>
        {sync.message ?? (sync.lastSyncedAt ? `Last synced ${relativeTime(sync.lastSyncedAt)}` : 'Not yet synced')}
      </TooltipContent>
    </Tooltip>
  );
}

function pickIcon(state: string) {
  switch (state) {
    case 'syncing':
      return Loader2;
    case 'offline':
      return CloudOff;
    case 'error':
      return AlertTriangle;
    case 'signed-out':
      return LogIn;
    default:
      return Cloud;
  }
}
