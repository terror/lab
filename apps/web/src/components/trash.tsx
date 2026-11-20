import { ConfirmDialog } from '@/components/confirm-dialog';
import { LoadError } from '@/components/load-error';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dissolve } from '@/components/ui/dissolve';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow, ListSkeleton } from '@/components/ui/list-row';
import { PageHeader } from '@/components/ui/page';
import { conversationTitle } from '@/lib/conversations';
import { shortDate } from '@/lib/format';
import { useMoment } from '@/lib/moment';
import { dissolve } from '@/lib/motion';
import {
  type TrashItem,
  deleteForever,
  emptyTrash,
  restoreFromTrash,
  trashPreviewQueryOptions,
  trashQueryOptions,
  useTrashAction,
} from '@/lib/trash';
import { emptyCopy } from '@/lib/voice';
import { useQuery } from '@tanstack/react-query';
import { Ellipsis, Folder, type LucideIcon, MessageSquare } from 'lucide-react';
import {
  AnimatePresence,
  m,
  useIsPresent,
  usePresenceData,
} from 'motion/react';
import { useState } from 'react';

const kinds: Record<
  TrashItem['kind'],
  { icon: LucideIcon; name: (item: TrashItem) => string }
> = {
  conversation: {
    icon: MessageSquare,
    name: ({ title }) => conversationTitle(title),
  },
  project: { icon: Folder, name: ({ title }) => title ?? 'Untitled project' },
};

const MotionListRow = m.create(ListRow);

function TrashPeek({ item }: { item: TrashItem }) {
  const preview = useQuery(trashPreviewQueryOptions(item));

  if (!preview.data) {
    return null;
  }

  if (preview.data.kind === 'project') {
    const { chats, count } = preview.data;

    if (count === 0) {
      return null;
    }

    return (
      <Card className='gap-1 px-4 py-3 text-sm' variant='inset'>
        <span className='text-xs text-muted-foreground'>
          {count} {count === 1 ? 'chat' : 'chats'}
        </span>
        <ul className='flex flex-col'>
          {chats.map((title, index) => (
            <li key={index} className='truncate'>
              {conversationTitle(title)}
            </li>
          ))}
        </ul>
      </Card>
    );
  }

  const { count, question, reply, startedAt } = preview.data;

  return (
    <Card className='gap-2 px-4 py-3 text-sm' variant='inset'>
      <span className='text-xs text-muted-foreground'>
        {count} {count === 1 ? 'message' : 'messages'} · started{' '}
        {shortDate(startedAt)}
      </span>
      {question && <p className='line-clamp-2 font-medium'>{question}</p>}
      {reply && <p className='line-clamp-3 text-muted-foreground'>{reply}</p>}
    </Card>
  );
}

const gone = { opacity: 0, transition: { duration: 0 } };

function TrashRow({ index, item }: { index: number; item: TrashItem }) {
  const [confirming, setConfirming] = useState(false);

  const restore = useTrashAction(restoreFromTrash);
  const remove = useTrashAction(deleteForever);

  const present = useIsPresent();
  const emptying = usePresenceData() === true;
  const still = !useMoment('places.dissolve').on;

  const { icon: Icon, name: title } = kinds[item.kind];

  const name = title(item);

  const deleting = !remove.isIdle && !remove.isError;

  const exit = (emptied: boolean) => {
    if (still || !(emptied || deleting)) {
      return gone;
    }

    return dissolve(emptied ? index : 0);
  };

  return (
    <MotionListRow
      className='overflow-hidden'
      exit='exit'
      inert={!present}
      variants={{ exit }}
      actions={
        <>
          <Button
            aria-label={`Restore ${name}`}
            disabled={restore.isPending}
            onClick={() => restore.mutate(item)}
            size='sm'
            variant='quiet'
          >
            Restore
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label={`Actions for ${name}`}
                size='icon-sm'
                variant='quiet'
              >
                <Ellipsis aria-hidden='true' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuItem
                disabled={remove.isPending}
                onSelect={() => setConfirming(true)}
                variant='destructive'
              >
                Delete forever
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ConfirmDialog
            action='Delete forever'
            description={`“${name}” will be deleted permanently. This can’t be undone.`}
            onConfirm={() => remove.mutate(item)}
            onOpenChange={setConfirming}
            open={confirming}
            title='Delete forever?'
          >
            <TrashPeek item={item} />
          </ConfirmDialog>
        </>
      }
    >
      <Dissolve
        active={!present && !still && (emptying || deleting)}
        className='items-center gap-3'
        order={emptying ? index : 0}
      >
        <Icon
          aria-hidden='true'
          className='size-4 shrink-0 text-muted-foreground'
        />
        <span className='flex min-w-0 flex-col'>
          <span className='truncate font-medium'>{name}</span>
          <span className='truncate text-muted-foreground'>
            Deleted {shortDate(item.deletedAt)}
          </span>
        </span>
      </Dissolve>
    </MotionListRow>
  );
}

export function Trash() {
  const trash = useQuery(trashQueryOptions);

  const [confirming, setConfirming] = useState(false);
  const [emptying, setEmptying] = useState(false);
  const [listed, setListed] = useState(false);

  const empty = useTrashAction(emptyTrash);

  const count = trash.data?.length ?? 0;

  if (count > 0 && !listed) {
    setListed(true);
  }

  const emptyState = emptyCopy('trash');

  return (
    <>
      <PageHeader
        actions={
          count > 0 && (
            <Button
              disabled={empty.isPending}
              onClick={() => setConfirming(true)}
              size='sm'
              variant='outline'
            >
              Empty trash
            </Button>
          )
        }
        description='Deleted chats and projects.'
        title='Trash'
      />
      {trash.isPending && <ListSkeleton />}
      {trash.isLoadingError && (
        <LoadError onRetry={() => trash.refetch()} subject='the trash' />
      )}
      {trash.isSuccess && count === 0 && !listed && (
        <EmptyState {...emptyState} />
      )}
      {listed && (
        <ul className='flex flex-col gap-0.5'>
          <AnimatePresence
            custom={emptying}
            initial={false}
            onExitComplete={() => {
              if (count === 0) {
                setListed(false);
                setEmptying(false);
              }
            }}
          >
            {trash.data?.map((item, index) => (
              <TrashRow
                key={`${item.kind}-${item.id}`}
                index={index}
                item={item}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}
      <ConfirmDialog
        action='Delete forever'
        description={`${count} ${count === 1 ? 'item' : 'items'} will be deleted permanently. This can’t be undone.`}
        onConfirm={() => {
          setEmptying(true);
          empty.mutate(undefined, { onError: () => setEmptying(false) });
        }}
        onOpenChange={setConfirming}
        open={confirming}
        title='Empty the trash?'
      />
    </>
  );
}
