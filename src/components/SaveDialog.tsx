import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { send } from '@/lib/messages';
import { toast } from 'sonner';
import { useStore } from '@/lib/store';
import { similarity } from '@/lib/tabs';
import type { Workspace } from '@/lib/types';
import { AlertTriangle } from 'lucide-react';

interface SaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SaveDialog({ open, onOpenChange }: SaveDialogProps) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [duplicate, setDuplicate] = useState<Workspace | null>(null);
  const workspaces = useStore((s) => s.workspaces);

  useEffect(() => {
    if (!open) return;
    setDuplicate(null);
    setName(`Workspace ${new Date().toLocaleString(undefined, { hour: 'numeric', minute: '2-digit' })}`);
    void (async () => {
      try {
        // Lightweight pre-capture for duplicate guard.
        const win = await chrome.windows.getCurrent({ populate: true });
        const urls = new Set((win.tabs ?? []).map((t) => t.url ?? '').filter(Boolean));
        const synthetic: Workspace = {
          id: '__pending__',
          name: '',
          createdAt: 0,
          updatedAt: 0,
          groups: [],
          looseTabs: [...urls].map((u) => ({ url: u, title: '' })),
        };
        const dup = workspaces
          .map((w) => ({ w, score: similarity(synthetic, w) }))
          .filter((x) => x.score > 0.95)
          .sort((a, b) => b.score - a.score)[0];
        if (dup) setDuplicate(dup.w);
      } catch {
        /* ignore */
      }
    })();
  }, [open, workspaces]);

  const submit = async () => {
    setBusy(true);
    try {
      await send({ type: 'workspace/capture', name });
      toast.success(`Saved "${name}"`);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save workspace</DialogTitle>
          <DialogDescription>Captures every tab group, color, and order in this window.</DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Workspace name"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim()) submit();
          }}
        />
        {duplicate && (
          <div className="flex items-start gap-2 rounded-md border border-amber-400/30 bg-amber-400/10 p-2 text-xs text-amber-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5" />
            <span>
              Looks ~95% identical to <span className="font-medium">{duplicate.name}</span>. Save anyway?
            </span>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !name.trim()}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
