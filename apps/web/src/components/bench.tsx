import { ApprovalSummary } from '@/components/approval-card';
import { toolRenderer } from '@/components/tools/registry';
import { ActivityRow } from '@/components/ui/activity-row';
import { Button } from '@/components/ui/button';
import { Dot } from '@/components/ui/dot';
import { LiveMark } from '@/components/ui/live-mark';
import { NeedsYouCard } from '@/components/ui/needs-you-card';
import { Pips } from '@/components/ui/pips';
import {
  conversationTitle,
  conversationsQueryKey,
  readConversation,
  useUnreadChats,
} from '@/lib/conversations';
import { ago, duration } from '@/lib/time';
import { cn } from '@/lib/utils';
import { type BriefKind, say, useQuiet } from '@/lib/voice';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

const VISIBLE = 6;

export function focusItem(item: Element | null | undefined) {
  (
    item?.querySelector<HTMLElement>('a') ?? (item as HTMLElement | null)
  )?.focus();
}

type Unread = NonNullable<ReturnType<typeof useUnreadChats>['data']>;

type Run = Unread['runs'][number];

type Ask = Unread['waiting'][number]['ask'];

type Item =
  | { chat: Unread['waiting'][number]; kind: 'needs' }
  | { chat: Unread['chats'][number]; kind: 'finished' }
  | { kind: 'running'; run: Run };

function benchItems({ chats, runs, waiting }: Unread): Item[] {
  return [
    ...waiting.map((chat) => ({ chat, kind: 'needs' as const })),
    ...chats.map((chat) => ({ chat, kind: 'finished' as const })),
    ...runs.map((run) => ({ kind: 'running' as const, run })),
  ];
}

function asked(ask: Ask) {
  if (ask?.kind === 'question') {
    return <p>{ask.question}</p>;
  }

  if (ask?.kind === 'approval') {
    return <ApprovalSummary action={ask.action} summary={ask.summary} />;
  }

  return undefined;
}

function doing({ step, tool }: Run) {
  if (step) {
    return `Step ${step.index} of ${step.count} · ${step.label}`;
  }

  if (tool === null) {
    return undefined;
  }

  return toolRenderer(tool).title({
    active: true,
    args: {},
    callId: '',
    details: undefined,
    history: [],
    output: '',
  });
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
        title={title}
      >
        {asked(chat.ask)}
      </NeedsYouCard>
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
  onRead: (event: React.MouseEvent) => void;
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

function Running({ lit, now, run }: { lit: boolean; now: number; run: Run }) {
  return (
    <ActivityRow
      className={cn(lit && 'bg-muted')}
      data-kind='running'
      detail={doing(run)}
      glyph={<LiveMark className='size-4' state='thinking' />}
      label='Running'
      progress={
        run.step ? (
          <Pips done={run.step.index - 1} total={run.step.count} />
        ) : undefined
      }
      renderLink={(row) => (
        <Link params={{ id: run.id }} to='/c/$id'>
          {row}
        </Link>
      )}
      time={
        run.startedAt === null
          ? undefined
          : duration(now - new Date(run.startedAt).getTime())
      }
      title={conversationTitle(run.title)}
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
  const [held, setHeld] = useState<number>();
  const list = useRef<HTMLUListElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(Date.now);

  const going = (unread.data?.runs.length ?? 0) > 0;

  useEffect(() => {
    if (!going) {
      return undefined;
    }

    const timer = window.setInterval(() => setNow(Date.now()), 1_000);

    return () => window.clearInterval(timer);
  }, [going]);

  const read = useMutation({
    mutationFn: (ids: number[]) => Promise.all(ids.map(readConversation)),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: conversationsQueryKey }),
  });

  const items = unread.data ? benchItems(unread.data) : [];

  if (items.length > 0 && !had) {
    setHad(true);
  }

  if (items.length === 0 && !had) {
    return null;
  }

  const chats = unread.data?.chats ?? [];

  const mark = (event: React.MouseEvent, ids: number[]) => {
    if (event.detail > 1) {
      return;
    }

    if ((event.nativeEvent as PointerEvent).pointerType === 'mouse') {
      setHeld(wrapper.current?.offsetHeight);
    }

    read.mutate(ids);
  };

  const shown =
    expanded || items.length <= VISIBLE + 1 ? items : items.slice(0, VISIBLE);

  const hidden = items.length - shown.length;

  if (items.length === 0) {
    return (
      <div
        ref={wrapper}
        onPointerLeave={() => setHeld(undefined)}
        style={{ minHeight: held }}
      >
        <output className='flex min-h-13 items-center gap-3 text-sm text-muted-foreground'>
          <span className='flex size-4 items-center justify-center'>
            <Dot tone='done' />
          </span>
          {say('caughtUp', undefined, { quiet, seed: '' })}
        </output>
      </div>
    );
  }

  return (
    <div
      ref={wrapper}
      className='flex flex-col gap-1'
      onPointerLeave={() => setHeld(undefined)}
      style={{ minHeight: held }}
    >
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
                onRead={(event) => mark(event, [item.chat.id])}
              />
            );
          }

          return (
            <Running
              key={`running-${item.run.id}`}
              lit={lit === 'running'}
              now={now}
              run={item.run}
            />
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
              onClick={(event) =>
                mark(
                  event,
                  chats.map(({ id }) => id)
                )
              }
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
