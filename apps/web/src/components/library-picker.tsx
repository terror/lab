import { Tile } from '@/components/library-tile';
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
import { type LibraryItem, useLibrarySearch } from '@/lib/library';
import { Search } from 'lucide-react';
import { useState } from 'react';

type PickerProps = {
  attached: ReadonlySet<number>;
  limit: number;
  onAdd: (items: LibraryItem[]) => Promise<void>;
  onCancel: () => void;
};

function describe(limit: number, full: boolean) {
  if (!full) {
    return `Choose up to ${limit} images and files to attach.`;
  }

  return limit === 1
    ? 'You can attach 1 more item.'
    : `You can attach ${limit} more items.`;
}

function PickerBody({ attached, limit, onAdd, onCancel }: PickerProps) {
  const [selected, setSelected] = useState<LibraryItem[]>([]);
  const [adding, setAdding] = useState(false);

  const full = selected.length >= limit;

  const add = async () => {
    setAdding(true);

    try {
      await onAdd(selected);
    } finally {
      setAdding(false);
    }
  };

  const { empty, error, items, loadMore, query, search, setSearch } =
    useLibrarySearch(undefined);

  const toggle = (item: LibraryItem) => {
    const others = selected.filter(({ id }) => id !== item.id);

    setSelected(others.length < selected.length ? others : [...selected, item]);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add from library</DialogTitle>
        <DialogDescription>{describe(limit, full)}</DialogDescription>
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
        {error && (
          <p role='alert' className='text-sm text-destructive'>
            Unable to load your library.
          </p>
        )}
        {empty && (
          <p className='py-16 text-center text-sm text-muted-foreground'>
            {query ? 'Nothing matches your search.' : 'Your library is empty.'}
          </p>
        )}
        <div className='grid grid-cols-3 gap-2 sm:grid-cols-4'>
          {items.map((item) => {
            const chosen = selected.some(({ id }) => id === item.id);

            return (
              <Tile
                key={item.id}
                disabled={attached.has(item.id) || (full && !chosen)}
                item={item}
                onOpen={() => toggle(item)}
                selected={chosen}
              />
            );
          })}
        </div>
        {loadMore && <LoadMore onLoadMore={loadMore} />}
      </div>
      <DialogFooter>
        <Button onClick={onCancel} variant='ghost'>
          Cancel
        </Button>
        <Button
          disabled={selected.length === 0 || adding}
          onClick={() => void add()}
        >
          {adding ? 'Adding…' : `Add ${selected.length || ''}`.trim()}
        </Button>
      </DialogFooter>
    </>
  );
}

export function LibraryPicker({
  onOpenChange,
  open,
  ...props
}: Omit<PickerProps, 'onCancel'> & {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className='sm:max-w-2xl'>
        <PickerBody {...props} onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
