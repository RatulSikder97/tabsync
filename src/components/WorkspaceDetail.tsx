import { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, GripVertical, Trash2, Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { GroupPill } from './GroupPill';
import { COLOR_HEX } from '@/lib/colors';
import type { SavedTab, SavedTabGroup, TabGroupColor, Workspace } from '@/lib/types';
import { TAB_GROUP_COLORS } from '@/lib/types';
import { cn } from '@/lib/utils';

interface WorkspaceDetailProps {
  workspace: Workspace;
  onUpdate: (next: Workspace) => void;
  onClose: () => void;
}

export function WorkspaceDetail({ workspace, onUpdate, onClose }: WorkspaceDetailProps) {
  const [draft, setDraft] = useState<Workspace>(workspace);
  const [dragging, setDragging] = useState<{ groupIdx: number; tabIdx: number } | null>(null);

  const updateGroup = (idx: number, patch: Partial<SavedTabGroup>) => {
    const groups = draft.groups.map((g, i) => (i === idx ? { ...g, ...patch } : g));
    setDraft({ ...draft, groups });
  };

  const removeTab = (gIdx: number, tIdx: number) => {
    const groups = draft.groups.map((g, i) =>
      i === gIdx ? { ...g, tabs: g.tabs.filter((_, j) => j !== tIdx) } : g,
    );
    setDraft({ ...draft, groups });
  };

  const moveTab = (from: { groupIdx: number; tabIdx: number }, to: { groupIdx: number; tabIdx: number }) => {
    if (from.groupIdx === to.groupIdx && from.tabIdx === to.tabIdx) return;
    const groups = draft.groups.map((g) => ({ ...g, tabs: [...g.tabs] }));
    const fromGroup = groups[from.groupIdx];
    const toGroup = groups[to.groupIdx];
    if (!fromGroup || !toGroup) return;
    const [moved] = fromGroup.tabs.splice(from.tabIdx, 1);
    if (!moved) return;
    toGroup.tabs.splice(to.tabIdx, 0, moved);
    setDraft({ ...draft, groups });
  };

  const save = () => {
    onUpdate({ ...draft, updatedAt: Date.now() });
    onClose();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
        <Input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="text-sm font-semibold"
          aria-label="Workspace name"
        />
        <Button size="sm" onClick={save}>Save</Button>
        <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex-1 space-y-3 overflow-auto p-3">
        {draft.groups.map((g, gi) => (
          <GroupSection
            key={g.id}
            group={g}
            onUpdate={(patch) => updateGroup(gi, patch)}
            onRemoveTab={(ti) => removeTab(gi, ti)}
            dragging={dragging}
            setDragging={setDragging}
            onDrop={(toIdx) => {
              if (!dragging) return;
              moveTab(dragging, { groupIdx: gi, tabIdx: toIdx });
              setDragging(null);
            }}
            groupIdx={gi}
          />
        ))}
        {draft.looseTabs.length > 0 && (
          <section className="rounded-md border border-border/60 bg-card/40 p-2">
            <h3 className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Loose tabs</h3>
            <ul>
              {draft.looseTabs.map((t, i) => (
                <TabRow
                  key={`${t.url}-${i}`}
                  tab={t}
                  onRemove={() => setDraft({ ...draft, looseTabs: draft.looseTabs.filter((_, j) => j !== i) })}
                />
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

interface GroupSectionProps {
  group: SavedTabGroup;
  groupIdx: number;
  onUpdate: (patch: Partial<SavedTabGroup>) => void;
  onRemoveTab: (idx: number) => void;
  dragging: { groupIdx: number; tabIdx: number } | null;
  setDragging: (d: { groupIdx: number; tabIdx: number } | null) => void;
  onDrop: (toIdx: number) => void;
}

function GroupSection({
  group,
  groupIdx,
  onUpdate,
  onRemoveTab,
  dragging,
  setDragging,
  onDrop,
}: GroupSectionProps) {
  const [open, setOpen] = useState(true);
  return (
    <section className="overflow-hidden rounded-md border border-border/60 bg-card/40">
      <header className="flex items-center gap-2 px-2 py-1.5">
        <button onClick={() => setOpen(!open)} aria-label="Toggle group">
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <ColorPicker color={group.color} onChange={(c) => onUpdate({ color: c })} />
        <Input
          value={group.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="h-7 flex-1 text-sm"
          aria-label="Group name"
        />
        <span className="text-[11px] text-muted-foreground">{group.tabs.length}</span>
      </header>
      {open && (
        <ul>
          {group.tabs.map((t, ti) => (
            <li
              key={`${t.url}-${ti}`}
              draggable
              onDragStart={() => setDragging({ groupIdx, tabIdx: ti })}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(ti)}
              className={cn(
                'flex items-center gap-2 px-2 py-1 hover:bg-accent',
                dragging?.groupIdx === groupIdx && dragging.tabIdx === ti && 'opacity-40',
              )}
            >
              <GripVertical className="h-3 w-3 text-muted-foreground" />
              {t.favIconUrl ? (
                <img src={t.favIconUrl} alt="" className="h-3.5 w-3.5 rounded-sm" />
              ) : (
                <div className="h-3.5 w-3.5 rounded-sm bg-muted" />
              )}
              <span className="flex-1 truncate text-sm" title={t.title}>{t.title || t.url}</span>
              <a
                href={t.url}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground"
                aria-label="Open link"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-3 w-3" />
              </a>
              <button
                onClick={() => onRemoveTab(ti)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Remove tab"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
          <li className="px-2 py-1 text-[11px] text-muted-foreground">
            <button className="inline-flex items-center gap-1 hover:text-foreground" disabled>
              <Plus className="h-3 w-3" /> Add tab — coming soon
            </button>
          </li>
        </ul>
      )}
      <footer className="px-2 py-1">
        <GroupPill color={group.color} label={group.name} count={group.tabs.length} />
      </footer>
    </section>
  );
}

function ColorPicker({ color, onChange }: { color: TabGroupColor; onChange: (c: TabGroupColor) => void }) {
  return (
    <div className="flex items-center gap-1">
      {TAB_GROUP_COLORS.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={cn(
            'h-3 w-3 rounded-full ring-offset-1 transition-transform',
            c === color ? 'scale-125 ring-2 ring-ring' : 'hover:scale-110',
          )}
          style={{ background: COLOR_HEX[c] }}
          aria-label={`Color ${c}`}
        />
      ))}
    </div>
  );
}

function TabRow({ tab, onRemove }: { tab: SavedTab; onRemove: () => void }) {
  return (
    <li className="flex items-center gap-2 px-2 py-1 hover:bg-accent">
      {tab.favIconUrl ? (
        <img src={tab.favIconUrl} alt="" className="h-3.5 w-3.5 rounded-sm" />
      ) : (
        <div className="h-3.5 w-3.5 rounded-sm bg-muted" />
      )}
      <span className="flex-1 truncate text-sm">{tab.title || tab.url}</span>
      <button onClick={onRemove} className="text-muted-foreground hover:text-foreground" aria-label="Remove">
        <Trash2 className="h-3 w-3" />
      </button>
    </li>
  );
}
