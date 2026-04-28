import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { send } from '@/lib/messages';
import { toast } from 'sonner';
import type { Workspace } from '@/lib/types';

const PRESETS: Array<{ label: string; ms: number }> = [
  { label: 'In 1 hour', ms: 60 * 60 * 1000 },
  { label: 'Tomorrow', ms: 24 * 60 * 60 * 1000 },
  { label: 'Next week', ms: 7 * 24 * 60 * 60 * 1000 },
];

export function SnoozeDialog({
  workspace,
  open,
  onOpenChange,
}: {
  workspace: Workspace | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [custom, setCustom] = useState('');

  const submit = async (until: number) => {
    if (!workspace) return;
    try {
      await send({ type: 'snooze/schedule', id: workspace.id, until });
      toast.success(`Snoozed "${workspace.name}"`);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Snooze failed');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Snooze {workspace?.name}</DialogTitle>
          <DialogDescription>You'll get a notification when it returns.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((p) => (
            <Button key={p.label} variant="secondary" onClick={() => submit(Date.now() + p.ms)}>
              {p.label}
            </Button>
          ))}
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Or pick a date/time</label>
          <Input type="datetime-local" value={custom} onChange={(e) => setCustom(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => {
              if (!custom) return;
              submit(new Date(custom).getTime());
            }}
            disabled={!custom}
          >
            Snooze
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
