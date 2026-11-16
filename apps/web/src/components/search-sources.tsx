import { CommandGroup, CommandItem } from '@/components/ui/command';
import { useConversationSearch, useConversations } from '@/lib/conversations';
import { useNavigate } from '@tanstack/react-router';
import { MessageSquare, Settings, SquarePen } from 'lucide-react';
import type { ComponentType } from 'react';

type SourceProps = { onDone: () => void; search: string };

export type SearchSource = {
  component: ComponentType<SourceProps>;
  id: string;
};

function Actions({ onDone }: SourceProps) {
  const navigate = useNavigate();

  const go = (to: '/' | '/settings') => {
    onDone();
    void navigate({ to });
  };

  return (
    <CommandGroup heading='Actions'>
      <CommandItem onSelect={() => go('/')} value='New chat'>
        <SquarePen aria-hidden='true' />
        New chat
      </CommandItem>
      <CommandItem onSelect={() => go('/settings')} value='Settings'>
        <Settings aria-hidden='true' />
        Settings
      </CommandItem>
    </CommandGroup>
  );
}

function Chats({ onDone, search }: SourceProps) {
  const navigate = useNavigate();
  const conversations = useConversations();
  const results = useConversationSearch(search);

  const chats = search ? results.data : conversations.data;

  if (!chats?.length) {
    return null;
  }

  return (
    <CommandGroup heading='Chats'>
      {chats.map(({ id, title }) => (
        <CommandItem
          key={id}
          onSelect={() => {
            onDone();
            void navigate({ params: { id }, to: '/c/$id' });
          }}
          value={`${title ?? 'New chat'} ${id}`}
        >
          <MessageSquare aria-hidden='true' />
          <span className='truncate'>{title ?? 'New chat'}</span>
        </CommandItem>
      ))}
    </CommandGroup>
  );
}

export const searchSources: SearchSource[] = [
  { component: Actions, id: 'actions' },
  { component: Chats, id: 'chats' },
];
