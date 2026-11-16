import { searchSources } from '@/components/search-sources';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandList,
} from '@/components/ui/command';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
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
        <Command>
          <CommandInput placeholder='Search...' />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            {searchSources.map(({ component: Source, id }) => (
              <Source key={id} onDone={close} />
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </SearchContext.Provider>
  );
}
