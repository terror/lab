import {
  type LibraryItem,
  libraryItemUrl,
  libraryThumbnailUrl,
} from '@/lib/library';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

function extension(name: string) {
  const dot = name.lastIndexOf('.');

  return dot > 0 ? name.slice(dot + 1).toUpperCase() : 'TXT';
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

function DocumentTile({ item }: { item: LibraryItem }) {
  return (
    <>
      <img
        alt=''
        className='size-full bg-white object-cover object-top transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none'
        decoding='async'
        loading='lazy'
        src={libraryThumbnailUrl(item.id)}
      />
      <span className='absolute top-3 left-3 rounded-md bg-background px-1.5 py-0.5 text-xs font-medium text-muted-foreground'>
        {extension(item.name)}
      </span>
      <span className='absolute inset-x-0 bottom-0 truncate bg-linear-to-t from-black/70 px-3 pt-8 pb-2.5 text-left text-sm font-medium text-white'>
        {item.name}
      </span>
    </>
  );
}

function TileContent({ item }: { item: LibraryItem }) {
  if (item.kind === 'image') {
    return (
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
    );
  }

  if (item.upload?.thumbnail) {
    return <DocumentTile item={item} />;
  }

  return <FileTile item={item} />;
}

export function Tile({
  disabled,
  item,
  onOpen,
  selected,
}: {
  disabled?: boolean;
  item: LibraryItem;
  onOpen: () => void;
  selected?: boolean;
}) {
  return (
    <button
      aria-label={item.name}
      aria-pressed={selected}
      className={cn(
        'group relative aspect-square overflow-hidden rounded-xl bg-muted outline-none disabled:opacity-40',
        selected && 'ring-2 ring-foreground'
      )}
      disabled={disabled}
      onClick={onOpen}
      type='button'
    >
      {selected && (
        <span className='absolute top-2 right-2 z-10 flex size-5 items-center justify-center rounded-full bg-foreground text-background'>
          <Check aria-hidden='true' className='size-3.5' />
        </span>
      )}
      <TileContent item={item} />
    </button>
  );
}
