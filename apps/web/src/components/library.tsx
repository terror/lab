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
import { EmptyState } from '@/components/ui/empty-state';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group';
import { Page, PageHeader } from '@/components/ui/page';
import { Pills } from '@/components/ui/pills';
import { SectionHeading } from '@/components/ui/section-heading';
import { Skeleton } from '@/components/ui/skeleton';
import { conversationTitle } from '@/lib/conversations';
import { formatBytes, shortDate } from '@/lib/format';
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
import { ChevronLeft, ChevronRight, Download, Search } from 'lucide-react';
import { type KeyboardEvent, useState } from 'react';

type Filter = 'all' | LibraryKind;

const filters: { label: string; value: Filter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Images', value: 'image' },
  { label: 'Files', value: 'file' },
];

const grid =
  'grid grid-cols-2 gap-2 @container @md:grid-cols-3 @xl:grid-cols-4';

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
            {shortDate(item.createdAt)} · {formatBytes(item.size)} · From{' '}
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
          <div className={cn('flex gap-1', !previous && !next && 'invisible')}>
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

function LibraryEmpty({
  filtered,
  onClear,
}: {
  filtered: boolean;
  onClear: () => void;
}) {
  if (filtered) {
    return (
      <EmptyState
        action={
          <Button onClick={onClear} size='sm' variant='outline'>
            Show everything
          </Button>
        }
        description='Nothing here matches that search and filter.'
        title='No matches'
      />
    );
  }

  return (
    <EmptyState
      action={
        <Button asChild size='sm' variant='outline'>
          <Link to='/'>Start a chat</Link>
        </Button>
      }
      description='Images and files from your chats land here.'
      title='Nothing on the shelves yet'
    />
  );
}

function TileSkeletons() {
  return (
    <div aria-busy='true' className={grid}>
      {[0, 1, 2, 3].map((tile) => (
        <Skeleton key={tile} className='aspect-square h-auto rounded-xl' />
      ))}
    </div>
  );
}

export function Library() {
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<number>();

  const library = useLibrarySearch(filter === 'all' ? undefined : filter);

  const { items, loadMore, query, search, setSearch } = library;

  const clear = () => {
    setSearch('');
    setFilter('all');
  };

  return (
    <div className='min-h-0 flex-1 overflow-y-auto'>
      <Page className='@container'>
        <PageHeader
          description='Images and files from your chats.'
          title='Library'
        />
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <Pills
            label='Filter'
            onValueChange={setFilter}
            options={filters}
            value={filter}
          />
          <InputGroup className='w-full sm:w-56'>
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
        {library.pending && <TileSkeletons />}
        {library.error && (
          <LoadError onRetry={() => library.refetch()} subject='your library' />
        )}
        {library.empty && (
          <LibraryEmpty
            filtered={query.length > 0 || filter !== 'all'}
            onClear={clear}
          />
        )}
        {groupByPeriod(items).map(([title, group]) => (
          <section key={title} className='flex flex-col gap-2'>
            <SectionHeading>{title}</SectionHeading>
            <div className={grid}>
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
        {library.pageError && (
          <LoadError
            onRetry={() => library.fetchNextPage()}
            subject='more of your library'
          />
        )}
        {loadMore && !library.pageError && <LoadMore onLoadMore={loadMore} />}
      </Page>
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
