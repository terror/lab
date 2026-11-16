import { Tile } from '@/components/library';
import { LoadMore } from '@/components/load-more';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group';
import { type LibraryItem, useLibrary } from '@/lib/library';
import { Search } from 'lucide-react';
import { useDeferredValue, useState } from 'react';

export function LibraryPicker({
  limit,
  onAdd,
  onOpenChange,
  open,
}: {
  limit: number;
  onAdd: (items: LibraryItem[]) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<LibraryItem[]>([]);

  const query = useDeferredValue(search.trim());

  const library = useLibrary(undefined, query || undefined);

  const items = library.data ?? [];

  const loadMore =
    library.hasNextPage && !library.isFetchingNextPage
      ? () => void library.fetchNextPage()
      : undefined;

  const toggle = (item: LibraryItem) => {
    const others = selected.filter(({ id }) => id !== item.id);

    if (others.length < selected.length) {
      setSelected(others);
    } else if (selected.length < limit) {
      setSelected([...selected, item]);
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>Add from library</DialogTitle>
          <DialogDescription>
            Choose up to {limit} images and files to attach.
          </DialogDescription>
        </DialogHeader>
        <InputGroup>
          <InputGroupAddon>
            <Search aria-hidden='true' />
          </InputGroupAddon>
          <InputGroupInput
            aria-label='Search library'
            onChange={(event) => setSearch(event.target.value)}
            placeholder='Search your files'
            value={search}
          />
        </InputGroup>
        <div className='-mx-1 max-h-112 min-h-48 overflow-y-auto p-1'>
          {library.isError && (
            <p role='alert' className='text-sm text-destructive'>
              Unable to load your library.
            </p>
          )}
          {library.isSuccess && items.length === 0 && (
            <p className='py-16 text-center text-sm text-muted-foreground'>
              {query
                ? 'Nothing matches your search.'
                : 'Your library is empty.'}
            </p>
          )}
          <div className='grid grid-cols-3 gap-2 sm:grid-cols-4'>
            {items.map((item) => (
              <Tile
                key={item.id}
                item={item}
                onOpen={() => toggle(item)}
                selected={selected.some(({ id }) => id === item.id)}
              />
            ))}
          </div>
          {loadMore && <LoadMore onLoadMore={loadMore} />}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant='ghost'>
            Cancel
          </Button>
          <Button
            disabled={selected.length === 0}
            onClick={() => onAdd(selected)}
          >
            {selected.length > 0 ? `Add ${selected.length}` : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
