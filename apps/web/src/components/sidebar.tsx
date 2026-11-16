import { LabMark } from '@/components/lab-mark';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth';
import {
  conversationsQueryOptions,
  createConversation,
} from '@/lib/conversations';
import { cn } from '@/lib/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut, Plus } from 'lucide-react';

export function Sidebar({
  selected,
  onSelect,
  user,
}: {
  selected: number | undefined;
  onSelect: (id: number) => void;
  user: { name: string; email: string };
}) {
  const queryClient = useQueryClient();

  const signOut = useMutation({
    mutationFn: () => authClient.signOut(),
    onSuccess: () => queryClient.clear(),
  });
  const conversations = useQuery(conversationsQueryOptions);

  const create = useMutation({
    mutationFn: createConversation,
    onSuccess: async (id) => {
      onSelect(id);
      await queryClient.invalidateQueries(conversationsQueryOptions);
    },
  });

  return (
    <aside className='flex w-64 shrink-0 flex-col gap-4 border-r bg-sidebar p-3 text-sidebar-foreground'>
      <div className='flex items-center gap-2 px-1'>
        <LabMark className='size-6' />
        <span className='font-semibold tracking-tight'>lab</span>
      </div>
      <Button
        disabled={create.isPending}
        onClick={() => create.mutate()}
        variant='outline'
      >
        <Plus aria-hidden='true' />
        New chat
      </Button>
      <nav
        aria-label='Chats'
        className='flex min-h-0 flex-col gap-1 overflow-y-auto'
      >
        {conversations.isError && (
          <p role='alert' className='px-2 text-sm text-destructive'>
            Unable to load chats.
          </p>
        )}
        {conversations.data?.map((conversation) => (
          <button
            key={conversation.id}
            aria-current={conversation.id === selected ? 'page' : undefined}
            className={cn(
              'rounded-lg px-2 py-1.5 text-left text-sm hover:bg-sidebar-accent',
              conversation.id === selected &&
                'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
            )}
            onClick={() => onSelect(conversation.id)}
            type='button'
          >
            <span className='block truncate'>
              {conversation.title ?? 'New chat'}
            </span>
          </button>
        ))}
      </nav>
      <div className='mt-auto flex items-center gap-2 border-t pt-3'>
        <div className='min-w-0 flex-1 px-1'>
          <p className='truncate text-sm font-medium'>{user.name}</p>
          <p className='truncate text-xs text-muted-foreground'>{user.email}</p>
        </div>
        <Button
          aria-label='Sign out'
          disabled={signOut.isPending}
          onClick={() => signOut.mutate()}
          size='icon'
          variant='ghost'
        >
          <LogOut aria-hidden='true' />
        </Button>
      </div>
    </aside>
  );
}
