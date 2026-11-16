import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { authClient } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronsUpDown, LogOut, Settings } from 'lucide-react';
import { useState } from 'react';

type User = { email: string; image?: string | null; name: string };

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function UserAvatar({ className, user }: { className?: string; user: User }) {
  return (
    <Avatar className={className}>
      {user.image && (
        <AvatarImage alt='' referrerPolicy='no-referrer' src={user.image} />
      )}
      <AvatarFallback>{initials(user.name)}</AvatarFallback>
    </Avatar>
  );
}

function Identity({ className, user }: { className?: string; user: User }) {
  return (
    <div className={cn('min-w-0 flex-1 text-left', className)}>
      <p className='truncate text-sm font-medium'>{user.name}</p>
      <p className='truncate text-xs text-muted-foreground'>{user.email}</p>
    </div>
  );
}

function SettingsDialog({
  onOpenChange,
  open,
  user,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  user: User;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Manage your Lab account.</DialogDescription>
        </DialogHeader>
        <section className='space-y-3'>
          <h3 className='text-sm font-medium text-muted-foreground'>Account</h3>
          <div className='flex items-center gap-3 rounded-xl border p-3'>
            <UserAvatar className='size-10' user={user} />
            <Identity user={user} />
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}

export function AccountMenu({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState(false);

  const signOut = useMutation({
    mutationFn: () => authClient.signOut(),
    onSuccess: () => queryClient.clear(),
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className='flex w-full items-center gap-3 rounded-lg p-2 outline-none hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=open]:bg-sidebar-accent'
            type='button'
          >
            <UserAvatar className='size-8' user={user} />
            <Identity user={user} />
            <ChevronsUpDown
              aria-hidden='true'
              className='size-4 shrink-0 text-muted-foreground'
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align='start'
          className='w-(--radix-dropdown-menu-trigger-width) min-w-56'
          side='top'
        >
          <DropdownMenuItem onSelect={() => setSettings(true)}>
            <Settings aria-hidden='true' />
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={signOut.isPending}
            onSelect={() => signOut.mutate()}
          >
            <LogOut aria-hidden='true' />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <SettingsDialog onOpenChange={setSettings} open={settings} user={user} />
    </>
  );
}
