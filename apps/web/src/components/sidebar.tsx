import { AccountMenu } from '@/components/account-menu';
import { ConversationItem } from '@/components/conversation-item';
import { LabMark } from '@/components/lab-mark';
import { conversationsQueryOptions } from '@/lib/conversations';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { SquarePen } from 'lucide-react';

export function Sidebar({
  selected,
  onNewChat,
  onSelect,
  user,
}: {
  selected: number | undefined;
  onNewChat: () => void;
  onSelect: (id: number) => void;
  user: { email: string; image?: string | null; name: string };
}) {
  const conversations = useQuery(conversationsQueryOptions);

  return (
    <aside className='flex h-full flex-col gap-4 bg-sidebar p-3 text-sidebar-foreground'>
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
      <div className='mt-auto'>
        <AccountMenu user={user} />
      </div>
    </aside>
  );
}
