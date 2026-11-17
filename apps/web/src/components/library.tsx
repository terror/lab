import { Tile } from '@/components/library-tile';
import { LoadError } from '@/components/load-error';
import { LoadMore } from '@/components/load-more';
import { PdfPages } from '@/components/pdf-pages';
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
import { conversationTitle } from '@/lib/conversations';
import {
  type LibraryItem,
  type LibraryKind,
  libraryItemUrl,
  libraryOriginalUrl,
  libraryTextQueryOptions,
  useLibrarySearch,
} from '@/lib/library';
import { period } from '@/lib/time';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  LibraryBig,
  Search,
} from 'lucide-react';
import { type KeyboardEvent, useState } from 'react';

type Filter = 'all' | LibraryKind;

const filters: { label: string; value: Filter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Images', value: 'image' },
  { label: 'Files', value: 'file' },
];

const fullDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

const bytes = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
  notation: 'compact',
  style: 'unit',
  unit: 'byte',
  unitDisplay: 'narrow',
});

function groupByPeriod(items: LibraryItem[]) {
  const now = new Date();

  const groups = new Map<string, LibraryItem[]>();

  for (const item of items) {
    const key = period(item.createdAt, now);

    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return [...groups];
}

function FilePreview({ id }: { id: number }) {
  const text = useQuery(libraryTextQueryOptions(id));

  return (
    <pre className='max-h-128 min-h-48 overflow-auto rounded-xl bg-muted p-4 font-mono text-xs/relaxed whitespace-pre-wrap'>
      {text.data ?? (text.isError ? 'Unable to load file.' : '')}
    </pre>
  );
}

function ItemPreview({ item }: { item: LibraryItem }) {
  if (item.kind === 'image') {
    return (
      <div className='flex justify-center rounded-xl bg-muted'>
        <img
          alt={item.name}
          className='max-h-128 rounded-xl object-contain'
          src={libraryItemUrl(item.id)}
        />
      </div>
    );
  }

  if (item.upload) {
    return (
      <PdfPages
        className='max-h-128 overflow-y-auto rounded-xl bg-muted p-3'
        url={libraryOriginalUrl(item.id)}
      />
    );
  }

  return <FilePreview id={item.id} />;
}

function Viewer({
  hasMore,
  id,
  items,
  onClose,
  onLoadMore,
  onOpen,
}: {
  hasMore: boolean;
  id: number;
  items: LibraryItem[];
  onClose: () => void;
  onLoadMore: () => Promise<LibraryItem[]>;
  onOpen: (id: number) => void;
}) {
  const index = items.findIndex((candidate) => candidate.id === id);

  const item = items[index];

  if (!item) {
    return null;
  }

  const before = items[index - 1];
  const after = items[index + 1];

  const previous = before ? () => onOpen(before.id) : undefined;

  const advance = async () => {
    const loaded = await onLoadMore();
    const following = loaded[loaded.findIndex((other) => other.id === id) + 1];

    if (following) {
      onOpen(following.id);
    }
  };

  const next = (() => {
    if (after) {
      return () => onOpen(after.id);
    }

    if (hasMore) {
      return () => void advance();
    }

    return undefined;
  })();

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowLeft') {
      previous?.();
    }

    if (event.key === 'ArrowRight') {
      next?.();
    }
  };

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      open
    >
      <DialogContent className='sm:max-w-3xl' onKeyDown={onKeyDown}>
        <DialogHeader>
          <DialogTitle className='truncate pr-8'>{item.name}</DialogTitle>
          <DialogDescription>
            {fullDate.format(new Date(item.createdAt))} ·{' '}
            {bytes.format(item.size)} · From{' '}
            <Link
              className='text-foreground underline-offset-4 hover:underline'
              onClick={onClose}
              params={{ id: item.conversation.id }}
              to='/c/$id'
            >
              {conversationTitle(item.conversation.title)}
            </Link>
          </DialogDescription>
        </DialogHeader>
        <ItemPreview item={item} />
        <DialogFooter className='sm:justify-between'>
          <div className='flex gap-1'>
            <Button
              aria-label='Previous'
              disabled={!previous}
              onClick={previous}
              size='icon'
              variant='ghost'
            >
              <ChevronLeft aria-hidden='true' />
            </Button>
            <Button
              aria-label='Next'
              disabled={!next}
              onClick={next}
              size='icon'
              variant='ghost'
            >
              <ChevronRight aria-hidden='true' />
            </Button>
          </div>
          <Button asChild>
            <a download={item.name} href={libraryItemUrl(item.id, true)}>
              <Download aria-hidden='true' />
              Download
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Empty({ searching }: { searching: boolean }) {
  return (
    <div className='flex flex-col items-center gap-3 py-24 text-center'>
      <LibraryBig aria-hidden='true' className='size-8 text-muted-foreground' />
      <div className='space-y-1'>
        <p className='font-medium'>
          {searching ? 'Nothing matches your search' : 'Your library is empty'}
        </p>
        <p className='text-sm text-muted-foreground'>
          Images and files you add to chats appear here.
        </p>
      </div>
    </div>
  );
}

export function Library() {
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<number>();

  const library = useLibrarySearch(filter === 'all' ? undefined : filter);

  const { items, loadMore, query, search, setSearch } = library;

  return (
    <div className='min-h-0 flex-1 overflow-y-auto'>
      <div className='mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8'>
        <div className='flex flex-wrap items-center justify-between gap-4'>
          <h1 className='text-2xl font-semibold tracking-tight'>Library</h1>
          <InputGroup className='w-full sm:w-64'>
            <InputGroupAddon>
              <Search aria-hidden='true' />
            </InputGroupAddon>
            <InputGroupInput
              aria-label='Search library'
              onChange={(event) => setSearch(event.target.value)}
              placeholder='Search'
              value={search}
            />
          </InputGroup>
        </div>
        <fieldset className='flex gap-1'>
          <legend className='sr-only'>Filter</legend>
          {filters.map(({ label, value }) => (
            <button
              key={value}
              aria-pressed={filter === value}
              className={cn(
                'rounded-full px-3 py-1 text-sm text-muted-foreground transition-colors outline-none hover:text-foreground',
                filter === value && 'bg-muted text-foreground'
              )}
              onClick={() => setFilter(value)}
              type='button'
            >
              {label}
            </button>
          ))}
        </fieldset>
        {library.error && <LoadError subject='your library' />}
        {library.empty && (
          <Empty searching={query.length > 0 || filter !== 'all'} />
        )}
        {groupByPeriod(items).map(([title, group]) => (
          <section key={title} className='flex flex-col gap-3'>
            <h2 className='text-sm font-medium text-muted-foreground'>
              {title}
            </h2>
            <div className='grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'>
              {group.map((item) => (
                <Tile
                  key={item.id}
                  item={item}
                  onOpen={() => setOpen(item.id)}
                />
              ))}
            </div>
          </section>
        ))}
        {loadMore && <LoadMore onLoadMore={loadMore} />}
      </div>
      {open !== undefined && (
        <Viewer
          hasMore={library.hasNextPage}
          id={open}
          items={items}
          onClose={() => setOpen(undefined)}
          onLoadMore={async () => (await library.fetchNextPage()).data ?? items}
          onOpen={setOpen}
        />
      )}
    </div>
  );
}
