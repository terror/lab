import { ActivityRow } from '@/components/ui/activity-row';
import { Button } from '@/components/ui/button';
import { Dot } from '@/components/ui/dot';
import { LiveMark } from '@/components/ui/live-mark';
import { NeedsYouCard } from '@/components/ui/needs-you-card';
import {
  conversationTitle,
  conversationsQueryKey,
  readConversation,
  useUnreadChats,
} from '@/lib/conversations';
import { ago } from '@/lib/time';
import { cn } from '@/lib/utils';
import { type BriefKind, say, useQuiet } from '@/lib/voice';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { X } from 'lucide-react';
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';

const VISIBLE = 6;

export function focusItem(item: Element | null | undefined) {
  (
    item?.querySelector<HTMLElement>('a') ?? (item as HTMLElement | null)
  )?.focus();
}

type Unread = NonNullable<ReturnType<typeof useUnreadChats>['data']>;

type Item =
  | { chat: Unread['waiting'][number]; kind: 'needs' }
  | { chat: Unread['chats'][number]; kind: 'finished' }
  | { count: number; kind: 'running' };

function benchItems({ chats, running, waiting }: Unread): Item[] {
  return [
    ...waiting.map((chat) => ({ chat, kind: 'needs' as const })),
    ...chats.map((chat) => ({ chat, kind: 'finished' as const })),
    ...(running > 0 ? [{ count: running, kind: 'running' as const }] : []),
  ];
}

function Needs({
  chat,
  lit,
}: {
  chat: Unread['waiting'][number];
  lit: boolean;
}) {
  const title = conversationTitle(chat.title);

  return (
    <li data-kind='needs'>
      <NeedsYouCard
        actions={
          <Button asChild size='sm' variant='outline'>
            <Link
              aria-label={`Review ${title}`}
              params={{ id: chat.id }}
              to='/c/$id'
            >
              Review
            </Link>
          </Button>
        }
        className={cn('transition-colors', lit && 'bg-muted')}
        renderLink={(name) => (
          <Link params={{ id: chat.id }} to='/c/$id'>
            {name}
          </Link>
        )}
        title={title}
      />
    </li>
  );
}

function Finished({
  chat,
  lit,
  onRead,
}: {
  chat: Unread['chats'][number];
  lit: boolean;
  onRead: () => void;
}) {
  const title = conversationTitle(chat.title);

  return (
    <ActivityRow
      actions={
        <Button
          aria-label={`Mark ${title} as read`}
          onClick={onRead}
          size='icon-sm'
          variant='quiet'
        >
          <X aria-hidden='true' />
        </Button>
      }
      className={cn(lit && 'bg-muted')}
      data-kind='finished'
      detail={chat.preview}
      glyph={<Dot tone='attention' />}
      label='Unread'
      renderLink={(row) => (
        <Link params={{ id: chat.id }} to='/c/$id'>
          {row}
        </Link>
      )}
      meta={chat.scheduled ? 'Scheduled' : undefined}
      time={ago(chat.finishedAt)}
      title={title}
    />
  );
}

function Running({ count, lit }: { count: number; lit: boolean }) {
  return (
    <ActivityRow
      className={cn(lit && 'bg-muted')}
      data-kind='running'
      glyph={<LiveMark className='size-4' state='thinking' />}
      tabIndex={-1}
      title={`${count} ${count === 1 ? 'chat' : 'chats'} running`}
    />
  );
}

export function Bench({
  expanded,
  lit,
  onExpand,
}: {
  expanded: boolean;
  lit: BriefKind | undefined;
  onExpand: () => void;
}) {
  const queryClient = useQueryClient();
  const quiet = useQuiet();
  const unread = useUnreadChats();
  const [had, setHad] = useState(false);
  const list = useRef<HTMLUListElement>(null);

  const read = useMutation({
    mutationFn: (ids: number[]) => Promise.all(ids.map(readConversation)),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: conversationsQueryKey }),
  });

  const items = unread.data ? benchItems(unread.data) : [];

  if (items.length > 0 && !had) {
    setHad(true);
  }

  if (items.length === 0) {
    return had ? (
      <output className='flex min-h-13 items-center gap-3 text-sm text-muted-foreground'>
        <span className='flex size-4 items-center justify-center'>
          <Dot tone='done' />
        </span>
        {say('caughtUp', undefined, { quiet, seed: '' })}
      </output>
    ) : null;
  }

  const chats = unread.data?.chats ?? [];

  const shown =
    expanded || items.length <= VISIBLE + 1 ? items : items.slice(0, VISIBLE);

  const hidden = items.length - shown.length;

  return (
    <div className='flex flex-col gap-1'>
      <ul ref={list} aria-label='Activity' className='flex flex-col gap-1'>
        {shown.map((item) => {
          if (item.kind === 'needs') {
            return (
              <Needs
                key={`needs-${item.chat.id}`}
                chat={item.chat}
                lit={lit === 'needs'}
              />
            );
          }

          if (item.kind === 'finished') {
            return (
              <Finished
                key={`finished-${item.chat.id}`}
                chat={item.chat}
                lit={lit === 'finished'}
                onRead={() => read.mutate([item.chat.id])}
              />
            );
          }

          return (
            <Running key='running' count={item.count} lit={lit === 'running'} />
          );
        })}
      </ul>
      {(hidden > 0 || chats.length > 1) && (
        <div className='-mx-2.5 flex items-center justify-between'>
          {hidden > 0 && (
            <Button
              onClick={() => {
                flushSync(onExpand);
                focusItem(list.current?.children[VISIBLE]);
              }}
              size='sm'
              variant='quiet'
            >
              +{hidden} more
            </Button>
          )}
          {chats.length > 1 && (
            <Button
              className='ml-auto'
              onClick={() => read.mutate(chats.map(({ id }) => id))}
              size='sm'
              variant='quiet'
            >
              Mark all read
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
