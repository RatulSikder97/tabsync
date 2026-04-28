import { useEffect, useRef, useState } from 'react';
import { Toaster, toast } from 'sonner';
import { Save, RotateCcw, PanelRightOpen, LogIn } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStore } from '@/lib/store';
import { useTheme } from '@/hooks/useTheme';
import { send } from '@/lib/messages';
import { relativeTime } from '@/lib/time';
import { GroupPill } from '@/components/GroupPill';

export function Popup() {
  useTheme();
  const hydrate = useStore((s) => s.hydrate);
  const workspaces = useStore((s) => s.workspaces);
  const profile = useStore((s) => s.profile);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const windowIdRef = useRef<number | null>(null);

  useEffect(() => {
    void hydrate();
    setName(`Workspace ${new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`);
    void send({ type: 'auth/get-user' }).catch(() => null);
    void chrome.windows.getCurrent().then((w) => {
      if (w.id !== undefined) windowIdRef.current = w.id;
    });
  }, [hydrate]);

  const save = async () => {
    setBusy(true);
    try {
      await send({ type: 'workspace/capture', name: name.trim() || 'Untitled' });
      toast.success('Saved');
      window.close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const restore = async (id: string, label: string) => {
    try {
      await send({ type: 'workspace/restore', id });
      toast.success(`Restored "${label}"`);
      window.close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Restore failed');
    }
  };

  const openPanel = () => {
    const id = windowIdRef.current;
    if (id === null) {
      toast.error('Window not ready — try again');
      return;
    }
    chrome.sidePanel
      .open({ windowId: id })
      .then(() => window.close())
      .catch((e: Error) => toast.error(e.message));
  };

  const recent = [...workspaces].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);

  return (
    <motion.div
      initial={{ opacity: 0, y: -2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex flex-col gap-2 p-2.5"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 mesh opacity-70" />

      <header className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="relative grid h-5 w-5 place-items-center overflow-hidden rounded-[6px]">
            <div className="absolute inset-0 mesh-strong" />
            <span className="relative text-[9px] font-bold tracking-tight text-white drop-shadow-sm">TS</span>
          </div>
          <span className="text-[12px] font-semibold tracking-tight">TabSync</span>
        </div>
        <div className="flex items-center gap-0.5">
          {!profile && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              aria-label="Sign in with Google"
              onClick={async () => {
                try {
                  await send({ type: 'auth/sign-in' });
                  toast.success('Signed in');
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Sign-in failed');
                }
              }}
            >
              <LogIn className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            aria-label="Open side panel"
            onClick={openPanel}
          >
            <PanelRightOpen className="h-3 w-3" />
          </Button>
        </div>
      </header>

      <div className="flex items-center gap-1.5">
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Workspace name"
          className="h-7 flex-1 text-[11px]"
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
        <Button className="h-7 gap-1 px-2.5 text-[11px]" onClick={save} disabled={busy}>
          <Save className="h-3 w-3" /> {busy ? 'Saving…' : 'Save'}
        </Button>
      </div>

      {recent.length > 0 && (
        <section className="space-y-0.5">
          <h3 className="px-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">Recent</h3>
          <ul className="flex flex-col gap-0.5">
            {recent.map((w) => (
              <motion.li
                key={w.id}
                whileHover={{ x: 1 }}
                className="flex items-center gap-2 rounded-md border border-border/50 bg-card/70 px-1.5 py-1 text-[11px]"
              >
                <button
                  onClick={() => restore(w.id, w.name)}
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-sm bg-primary/15 text-primary hover:bg-primary/25"
                  aria-label={`Restore ${w.name}`}
                >
                  <RotateCcw className="h-2.5 w-2.5" />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium leading-tight">{w.name}</div>
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {w.groups.slice(0, 3).map((g) => (
                      <GroupPill key={g.id} color={g.color} count={g.tabs.length} />
                    ))}
                  </div>
                </div>
                <span className="shrink-0 text-[9px] text-muted-foreground">{relativeTime(w.updatedAt)}</span>
              </motion.li>
            ))}
          </ul>
        </section>
      )}

      <Toaster position="bottom-right" theme="dark" richColors closeButton />
    </motion.div>
  );
}
