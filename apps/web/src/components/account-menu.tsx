import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { type User, authClient } from '@/lib/auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ChevronsUpDown, LogOut, Settings } from 'lucide-react';
import type { ComponentProps } from 'react';

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

function Identity({ user }: { user: User }) {
  return (
    <div className='min-w-0 flex-1 text-left'>
      <p className='truncate text-sm font-medium'>{user.name}</p>
      <p className='truncate text-xs text-muted-foreground'>{user.email}</p>
    </div>
  );
}

function AccountTrigger({
  compact,
  user,
  ...props
}: ComponentProps<'button'> & { compact: boolean; user: User }) {
  if (compact) {
    return (
      <button
        aria-label='Account'
        className='rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50'
        title={user.name}
        type='button'
        {...props}
      >
        <UserAvatar className='size-8' user={user} />
      </button>
    );
  }

  return (
    <button
      className='flex w-full items-center gap-3 rounded-lg p-2 outline-none hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=open]:bg-sidebar-accent'
      type='button'
      {...props}
    >
      <UserAvatar className='size-8' user={user} />
      <Identity user={user} />
      <ChevronsUpDown
        aria-hidden='true'
        className='size-4 shrink-0 text-muted-foreground'
      />
    </button>
  );
}

export function AccountMenu({
  compact = false,
  user,
}: {
  compact?: boolean;
  user: User;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const signOut = useMutation({
    mutationFn: () => authClient.signOut(),
    onSuccess: () => queryClient.clear(),
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <AccountTrigger compact={compact} user={user} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={compact ? 'end' : 'start'}
        className='w-(--radix-dropdown-menu-trigger-width) min-w-56'
        side={compact ? 'right' : 'top'}
      >
        <DropdownMenuItem onSelect={() => void navigate({ to: '/settings' })}>
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
  );
}
