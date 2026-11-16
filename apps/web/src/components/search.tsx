import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  conversationTitle,
  useConversationSearch,
  useConversations,
} from '@/lib/conversations';
import { useNavigate } from '@tanstack/react-router';
import { MessageSquare, Settings, SquarePen } from 'lucide-react';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';

const SearchContext = createContext<{ openSearch: () => void }>({
  openSearch: () => undefined,
});

export function useSearch() {
  return useContext(SearchContext);
}

function Actions({ onDone }: { onDone: () => void }) {
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

function Chats({ onDone, search }: { onDone: () => void; search: string }) {
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
          value={`${conversationTitle(title)} ${id}`}
        >
          <MessageSquare aria-hidden='true' />
          <span className='truncate'>{conversationTitle(title)}</span>
        </CommandItem>
      ))}
    </CommandGroup>
  );
}

function SearchCommand({ onDone }: { onDone: () => void }) {
  const [search, setSearch] = useState('');

  const query = useDeferredValue(search.trim());

  return (
    <Command>
      <CommandInput
        onValueChange={setSearch}
        placeholder='Search...'
        value={search}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <Actions onDone={onDone} />
        <Chats onDone={onDone} search={query} />
      </CommandList>
    </Command>
  );
}

export function SearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const openSearch = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const value = useMemo(() => ({ openSearch }), [openSearch]);

  return (
    <SearchContext.Provider value={value}>
      {children}
      <CommandDialog
        description='Search chats and actions'
        onOpenChange={setOpen}
        open={open}
        title='Search'
      >
        <SearchCommand onDone={close} />
      </CommandDialog>
    </SearchContext.Provider>
  );
}
