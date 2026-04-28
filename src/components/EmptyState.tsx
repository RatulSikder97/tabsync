import { Save, Cloud, Layers } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/store';
import { send } from '@/lib/messages';
import { toast } from 'sonner';

export function EmptyState({ onSave }: { onSave: () => void }) {
  const profile = useStore((s) => s.profile);

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-5 overflow-hidden px-6 py-10 text-center">
      <div className="pointer-events-none absolute inset-0 -z-10 mesh opacity-90" />

      <motion.div
        initial={{ opacity: 0, y: 6, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative"
      >
        <motion.div
          aria-hidden
          className="absolute -inset-6 rounded-full bg-primary/30 blur-2xl"
          animate={{ scale: [1, 1.08, 1], opacity: [0.5, 0.7, 0.5] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
          className="relative grid h-14 w-14 place-items-center overflow-hidden rounded-2xl bg-card shadow-md ring-1 ring-border"
        >
          <div className="absolute inset-0 mesh-strong" />
          <Layers className="relative h-6 w-6 text-white drop-shadow" />
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="space-y-1"
      >
        <h2 className="text-base font-semibold tracking-tight">Welcome to TabSync</h2>
        <p className="max-w-[260px] text-xs text-muted-foreground">
          Save tab groups as workspaces, restore in one click, sync them across devices.
        </p>
      </motion.div>

      <motion.ol
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } } }}
        className="grid w-full max-w-[280px] gap-1.5 text-left text-xs"
      >
        <Step n={1} label="Sign in with Google" done={!!profile} />
        <Step n={2} label="Open some tabs to save" done={false} />
        <Step n={3} label="Click Save to capture them" done={false} />
      </motion.ol>

      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.25 }}
      >
        {!profile ? (
          <Button
            size="sm"
            className="h-8 gap-1.5 px-3 text-xs"
            onClick={async () => {
              try {
                await send({ type: 'auth/sign-in' });
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Sign-in failed');
              }
            }}
          >
            <Cloud className="h-3.5 w-3.5" />
            Sign in with Google
          </Button>
        ) : (
          <Button size="sm" className="h-8 gap-1.5 px-3 text-xs" onClick={onSave}>
            <Save className="h-3.5 w-3.5" />
            Save first workspace
          </Button>
        )}
      </motion.div>
    </div>
  );
}

function Step({ n, label, done }: { n: number; label: string; done: boolean }) {
  return (
    <motion.li
      variants={{ hidden: { opacity: 0, x: -6 }, show: { opacity: 1, x: 0 } }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center gap-2.5 rounded-md border border-border/60 bg-card/60 px-2.5 py-1.5 backdrop-blur-sm"
    >
      <span
        className={
          done
            ? 'grid h-4 w-4 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground'
            : 'grid h-4 w-4 place-items-center rounded-full border border-border text-[10px] text-muted-foreground'
        }
      >
        {n}
      </span>
      <span className={done ? 'text-foreground line-through decoration-primary/50' : 'text-foreground'}>{label}</span>
    </motion.li>
  );
}
