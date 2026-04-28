import { LogIn, LogOut, RefreshCw } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/store';
import { send } from '@/lib/messages';
import { toast } from 'sonner';

export function AccountMenu() {
  const profile = useStore((s) => s.profile);

  if (!profile) {
    return (
      <Button
        size="icon"
        variant="ghost"
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
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-full p-0.5 hover:bg-accent" aria-label="Account">
          {profile.picture ? (
            <img src={profile.picture} alt={profile.email} className="h-5 w-5 rounded-full" />
          ) : (
            <div className="h-5 w-5 rounded-full bg-primary/30" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="font-medium text-foreground">{profile.name ?? 'Signed in'}</span>
          <span className="font-mono text-[11px] text-muted-foreground">{profile.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            try {
              await send({ type: 'sync/now' });
              toast.success('Synced');
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Sync failed');
            }
          }}
        >
          <RefreshCw className="mr-2 h-3.5 w-3.5" /> Sync now
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={async () => {
            await send({ type: 'auth/sign-out' });
            toast('Signed out');
          }}
        >
          <LogOut className="mr-2 h-3.5 w-3.5" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
