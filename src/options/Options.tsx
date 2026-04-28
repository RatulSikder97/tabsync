import { useEffect, useRef } from 'react';
import { Toaster, toast } from 'sonner';
import { Download, Upload, Keyboard, Cloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useStore } from '@/lib/store';
import { useTheme } from '@/hooks/useTheme';
import { send } from '@/lib/messages';
import type { Workspace } from '@/lib/types';

export function Options() {
  useTheme();
  const hydrate = useStore((s) => s.hydrate);
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const workspaces = useStore((s) => s.workspaces);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ workspaces }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tabsync-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { workspaces: Workspace[] };
      if (!Array.isArray(parsed.workspaces)) throw new Error('Invalid file');
      for (const ws of parsed.workspaces) {
        await send({ type: 'workspace/update', workspace: ws });
      }
      toast.success(`Imported ${parsed.workspaces.length} workspaces`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed');
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">TabSync settings</h1>
        <p className="text-sm text-muted-foreground">Configure auto-snapshot, theme, and sync behavior.</p>
      </header>

      <Section title="Auto-snapshot" icon={<Cloud className="h-4 w-4" />}>
        <Row label="Take an automatic snapshot every">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              step={1}
              value={settings.autoSnapshotMinutes}
              onChange={(e) => setSettings({ autoSnapshotMinutes: Math.max(0, Number(e.target.value) || 0) })}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">minutes (0 disables)</span>
          </div>
        </Row>
        <Row label="Sync poll interval">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={15}
              step={5}
              value={settings.syncPollSeconds}
              onChange={(e) => setSettings({ syncPollSeconds: Math.max(15, Number(e.target.value) || 45) })}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">seconds</span>
          </div>
        </Row>
      </Section>

      <Section title="Appearance">
        <Row label="Theme">
          <select
            value={settings.theme}
            onChange={(e) => setSettings({ theme: e.target.value as typeof settings.theme })}
            className="h-9 rounded-sm border border-input bg-background px-3 text-sm"
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="system">System</option>
          </select>
        </Row>
        <Row label="Reduced motion">
          <Switch checked={false} disabled aria-label="Reduced motion (uses system setting)" />
        </Row>
      </Section>

      <Section title="Backup" icon={<Download className="h-4 w-4" />}>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={exportJson}>
            <Download className="h-3.5 w-3.5" /> Export JSON
          </Button>
          <Button variant="secondary" onClick={() => fileInput.current?.click()}>
            <Upload className="h-3.5 w-3.5" /> Import JSON
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importJson(f);
              e.target.value = '';
            }}
          />
        </div>
      </Section>

      <Section title="Keyboard shortcuts" icon={<Keyboard className="h-4 w-4" />}>
        <p className="text-sm text-muted-foreground">
          Manage in <span className="font-mono text-xs">chrome://extensions/shortcuts</span>.
        </p>
      </Section>

      <Toaster position="bottom-right" theme="dark" richColors closeButton />
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border/60 bg-card/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-sm text-foreground">{label}</span>
      {children}
    </div>
  );
}
