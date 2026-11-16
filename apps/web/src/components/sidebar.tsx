import { ConversationItem } from '@/components/conversation-item';
import { LabMark } from '@/components/lab-mark';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth';
import { conversationsQueryOptions } from '@/lib/conversations';
import { cn } from '@/lib/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut, SquarePen } from 'lucide-react';

export function Sidebar({
  selected,
  onNewChat,
  onSelect,
  user,
}: {
  selected: number | undefined;
  onNewChat: () => void;
  onSelect: (id: number) => void;
  user: { name: string; email: string };
}) {
  const queryClient = useQueryClient();

  const signOut = useMutation({
    mutationFn: () => authClient.signOut(),
    onSuccess: () => queryClient.clear(),
  });
  const conversations = useQuery(conversationsQueryOptions);

  return (
    <aside className='flex w-64 shrink-0 flex-col gap-4 border-r bg-sidebar p-3 text-sidebar-foreground'>
      <div className='px-1'>
        <LabMark className='size-6' />
      </div>
      <button
        aria-current={selected === undefined ? 'page' : undefined}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors outline-none hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-ring/50',
          selected === undefined &&
            'bg-sidebar-accent text-sidebar-accent-foreground'
        )}
        onClick={onNewChat}
        type='button'
      >
        <SquarePen aria-hidden='true' className='size-4' />
        New chat
      </button>
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
          <ConversationItem
            key={conversation.id}
            conversation={conversation}
            onSelect={onSelect}
            selected={conversation.id === selected}
          />
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
