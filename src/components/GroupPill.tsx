import { cn } from '@/lib/utils';
import { COLOR_HEX } from '@/lib/colors';
import type { TabGroupColor } from '@/lib/types';

interface GroupPillProps {
  color: TabGroupColor;
  label?: string;
  count?: number;
  className?: string;
}

export function GroupPill({ color, label, count, className }: GroupPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-foreground',
        className,
      )}
      style={{ boxShadow: `inset 0 0 0 1px ${COLOR_HEX[color]}1a` }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: COLOR_HEX[color], boxShadow: `0 0 6px ${COLOR_HEX[color]}66` }}
      />
      {label && <span className="max-w-[110px] truncate">{label}</span>}
      {count !== undefined && <span className="text-muted-foreground">{count}</span>}
    </span>
  );
}
