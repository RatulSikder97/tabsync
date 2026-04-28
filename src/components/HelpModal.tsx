import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface HelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SHORTCUTS: Array<{ keys: string; label: string }> = [
  { keys: '⌘ K', label: 'Open command palette' },
  { keys: '⌘ S', label: 'Save current window as workspace' },
  { keys: '⌘ ⇧ L', label: 'Restore most recent workspace' },
  { keys: '⌘ ⇧ O', label: 'Open TabSync side panel' },
  { keys: '⌘ ⇧ S', label: 'Open quick-save popup' },
  { keys: '/', label: 'Focus search' },
  { keys: '?', label: 'Show this help' },
  { keys: 'Esc', label: 'Close current modal' },
];

export function HelpModal({ open, onOpenChange }: HelpModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Move faster, save more workspaces.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-center justify-between rounded-sm border border-border/60 px-2 py-1.5">
              <span className="text-sm text-foreground">{s.label}</span>
              <kbd className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10px]">{s.keys}</kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
