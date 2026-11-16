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
  libraryTextQueryOptions,
  useLibrary,
} from '@/lib/library';
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
import {
  type KeyboardEvent,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from 'react';

type Filter = 'all' | LibraryKind;

const filters: { label: string; value: Filter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Images', value: 'image' },
  { label: 'Files', value: 'file' },
];

const DAY = 86_400_000;

const month = new Intl.DateTimeFormat('en-US', { month: 'long' });

const monthYear = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
});

const fullDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

const bytes = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
  notation: 'compact',
  style: 'unit',
  unit: 'byte',
  unitDisplay: 'narrow',
});

function period(value: string, now: Date) {
  const date = new Date(value);

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const days = Math.ceil((today.getTime() - date.getTime()) / DAY);

  if (days <= 0) {
    return 'Today';
  }

  if (days === 1) {
    return 'Yesterday';
  }

  if (days <= 7) {
    return 'Previous 7 days';
  }

  if (days <= 30) {
    return 'Previous 30 days';
  }

  return date.getFullYear() === now.getFullYear()
    ? month.format(date)
    : monthYear.format(date);
}

function groupByPeriod(items: LibraryItem[]) {
  const now = new Date();

  const groups = new Map<string, LibraryItem[]>();

  for (const item of items) {
    const key = period(item.createdAt, now);

    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return [...groups];
}

function extension(name: string) {
  const dot = name.lastIndexOf('.');

  return dot > 0 ? name.slice(dot + 1).toUpperCase() : 'TXT';
}

function LoadMore({ onLoadMore }: { onLoadMore: () => void }) {
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = sentinel.current;

    if (!element) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          onLoadMore();
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [onLoadMore]);

  return <div ref={sentinel} className='h-px' />;
}

function FileTile({ item }: { item: LibraryItem }) {
  return (
    <div className='flex size-full flex-col gap-2 p-3 text-left'>
      <span className='self-start rounded-md bg-background px-1.5 py-0.5 text-xs font-medium text-muted-foreground'>
        {extension(item.name)}
      </span>
      <p className='line-clamp-6 min-h-0 font-mono text-xs/relaxed break-all whitespace-pre-wrap text-muted-foreground'>
        {item.preview}
      </p>
      <span className='mt-auto truncate text-sm font-medium'>{item.name}</span>
    </div>
  );
}

function Tile({ item, onOpen }: { item: LibraryItem; onOpen: () => void }) {
  return (
    <button
      aria-label={item.name}
      className='group relative aspect-square overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50'
      onClick={onOpen}
      type='button'
    >
      {item.kind === 'image' ? (
        <>
          <img
            alt=''
            className='size-full object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none'
            decoding='async'
            loading='lazy'
            src={libraryItemUrl(item.id)}
          />
          <span className='absolute inset-x-0 bottom-0 truncate bg-linear-to-t from-black/60 px-3 pt-6 pb-2 text-left text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100'>
            {item.name}
          </span>
        </>
      ) : (
        <FileTile item={item} />
      )}
    </button>
  );
}

function FilePreview({ id }: { id: number }) {
  const text = useQuery(libraryTextQueryOptions(id));

  return (
    <pre className='max-h-128 min-h-48 overflow-auto rounded-xl bg-muted p-4 font-mono text-xs/relaxed whitespace-pre-wrap'>
      {text.data ?? (text.isError ? 'Unable to load file.' : '')}
    </pre>
  );
}

function Viewer({
  index,
  items,
  onIndexChange,
  onClose,
}: {
  index: number;
  items: LibraryItem[];
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const item = items[index];

  if (!item) {
    return null;
  }

  const previous = index > 0 ? () => onIndexChange(index - 1) : undefined;

  const next =
    index < items.length - 1 ? () => onIndexChange(index + 1) : undefined;

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
        {item.kind === 'image' ? (
          <div className='flex justify-center rounded-xl bg-muted'>
            <img
              alt={item.name}
              className='max-h-128 rounded-xl object-contain'
              src={libraryItemUrl(item.id)}
            />
          </div>
        ) : (
          <FilePreview id={item.id} />
        )}
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
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<number>();

  const query = useDeferredValue(search.trim());

  const library = useLibrary(
    filter === 'all' ? undefined : filter,
    query || undefined
  );

  const items = library.data ?? [];

  const loadMore =
    library.hasNextPage && !library.isFetchingNextPage
      ? () => void library.fetchNextPage()
      : undefined;

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
                'rounded-full px-3 py-1 text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50',
                filter === value && 'bg-muted text-foreground'
              )}
              onClick={() => setFilter(value)}
              type='button'
            >
              {label}
            </button>
          ))}
        </fieldset>
        {library.isError && (
          <p role='alert' className='text-sm text-destructive'>
            Unable to load your library.
          </p>
        )}
        {library.isSuccess && items.length === 0 && (
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
                  onOpen={() => setOpen(items.indexOf(item))}
                />
              ))}
            </div>
          </section>
        ))}
        {loadMore && <LoadMore onLoadMore={loadMore} />}
      </div>
      {open !== undefined && (
        <Viewer
          index={open}
          items={items}
          onClose={() => setOpen(undefined)}
          onIndexChange={setOpen}
        />
      )}
    </div>
  );
}
