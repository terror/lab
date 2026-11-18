import { ConfirmDialog } from '@/components/confirm-dialog';
import { LoadError } from '@/components/load-error';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page';
import { conversationTitle } from '@/lib/conversations';
import { shortDate } from '@/lib/format';
import {
  type TrashItem,
  deleteForever,
  emptyTrash,
  restoreFromTrash,
  trashQueryOptions,
  useTrashAction,
} from '@/lib/trash';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

const names: Record<TrashItem['kind'], (item: TrashItem) => string> = {
  conversation: ({ title }) => conversationTitle(title),
  project: ({ title }) => title ?? 'Untitled project',
};

function TrashRow({ item }: { item: TrashItem }) {
  const [confirming, setConfirming] = useState(false);

  const restore = useTrashAction(restoreFromTrash);
  const remove = useTrashAction(deleteForever);

  const name = names[item.kind](item);

  return (
    <li className='flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-muted/50'>
      <div className='min-w-0 flex-1'>
        <p className='truncate text-sm font-medium'>{name}</p>
        <p className='truncate text-sm text-muted-foreground'>
          Deleted {shortDate(item.deletedAt)}
        </p>
      </div>
      <div className='flex shrink-0 items-center gap-1'>
        <Button
          aria-label={`Delete ${name} forever`}
          disabled={remove.isPending}
          onClick={() => setConfirming(true)}
          size='sm'
          variant='ghost'
        >
          Delete forever
        </Button>
        <Button
          aria-label={`Restore ${name}`}
          disabled={restore.isPending}
          onClick={() => restore.mutate(item)}
          size='sm'
          variant='secondary'
        >
          Restore
        </Button>
      </div>
      <ConfirmDialog
        action='Delete forever'
        description={`“${name}” will be deleted permanently. This can’t be undone.`}
        onConfirm={() => remove.mutate(item)}
        onOpenChange={setConfirming}
        open={confirming}
        title='Delete forever?'
      />
    </li>
  );
}

export function Trash() {
  const trash = useQuery(trashQueryOptions);

  const [confirming, setConfirming] = useState(false);

  const empty = useTrashAction(emptyTrash);

  const count = trash.data?.length ?? 0;

  return (
    <>
      <PageHeader
        actions={
          count > 0 && (
            <Button
              disabled={empty.isPending}
              onClick={() => setConfirming(true)}
              size='sm'
              variant='secondary'
            >
              Empty trash
            </Button>
          )
        }
        description={
          'Deleted chats and projects stay here until you restore them or delete them forever.'
        }
        title='Trash'
      />
      {trash.isError && <LoadError subject='the trash' />}
      {trash.isSuccess && count === 0 && (
        <p className='text-sm text-muted-foreground'>The trash is empty.</p>
      )}
      {count > 0 && (
        <ul className='-mx-3 flex flex-col'>
          {trash.data?.map((item) => (
            <TrashRow key={`${item.kind}-${item.id}`} item={item} />
          ))}
        </ul>
      )}
      <ConfirmDialog
        action='Delete forever'
        description={`${count} ${count === 1 ? 'item' : 'items'} will be deleted permanently. This can’t be undone.`}
        onConfirm={() => empty.mutate(undefined)}
        onOpenChange={setConfirming}
        open={confirming}
        title='Empty the trash?'
      />
    </>
  );
}
