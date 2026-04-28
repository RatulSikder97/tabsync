import { Search, Settings, Save, Command } from 'lucide-react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SyncStatus } from './SyncStatus';
import { AccountMenu } from './AccountMenu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface HeaderProps {
  query: string;
  onQueryChange: (q: string) => void;
  onOpenPalette: () => void;
  onSave: () => void;
}

export function Header({ query, onQueryChange, onOpenPalette, onSave }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 isolate border-b border-border/60 bg-background/85 backdrop-blur-xl">
      <div className="absolute inset-0 -z-10 mesh opacity-80" />

      {/* Row 1: identity + status */}
      <div className="flex items-center gap-1 px-2 pb-1 pt-1.5">
        <motion.div
          initial={{ opacity: 0, y: -3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-1.5 pr-1"
        >
          <div className="relative grid h-5 w-5 place-items-center overflow-hidden rounded-[6px]">
            <div className="absolute inset-0 mesh-strong" />
            <span className="relative text-[9px] font-bold tracking-tight text-white drop-shadow-sm">TS</span>
          </div>
          <span className="text-[12px] font-semibold tracking-tight">TabSync</span>
        </motion.div>

        <div className="flex-1" />

        <SyncStatus />
        <AccountMenu />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              aria-label="Settings"
              onClick={() => chrome.runtime.openOptionsPage()}
            >
              <Settings className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Settings</TooltipContent>
        </Tooltip>
      </div>

      {/* Row 2: search + actions */}
      <div className="flex items-center gap-1 px-2 pb-1.5">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search workspaces…"
            className="h-7 pl-7 text-[11px]"
            aria-label="Search workspaces"
          />
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onOpenPalette} aria-label="Command palette">
              <Command className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Palette ⌘K</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="default" size="sm" className="h-7 gap-1 px-2.5 text-[11px]" onClick={onSave}>
              <Save className="h-3 w-3" />
              Save
            </Button>
          </TooltipTrigger>
          <TooltipContent>Save current window</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
