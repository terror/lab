import { ApprovalSummary } from '@/components/approval-card';
import { ErrorMessage } from '@/components/error-message';
import { QuestionOptions } from '@/components/question-card';
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
  useAnswer,
  useUnreadChats,
} from '@/lib/conversations';
import { ago, duration } from '@/lib/time';
import { cn } from '@/lib/utils';
import type { BriefKind } from '@/lib/voice';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

const VISIBLE = 6;

const INERT_MS = 400;

export function focusItem(item: Element | null | undefined) {
  (
    item?.querySelector<HTMLElement>('a') ?? (item as HTMLElement | null)
  )?.focus();
}

type Unread = NonNullable<ReturnType<typeof useUnreadChats>['data']>;

type Run = Unread['runs'][number];

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

function useArmed(key: string | undefined) {
  const [armed, setArmed] = useState<string>();

  useEffect(() => {
    const timer = window.setTimeout(() => setArmed(key), INERT_MS);

    return () => window.clearTimeout(timer);
  }, [key]);

  return key !== undefined && armed === key;
}

function Needs({
  chat,
  lit,
  onChoose,
  onInside,
}: {
  chat: Unread['waiting'][number];
  lit: boolean;
  onChoose: (said: string) => void;
  onInside: (change: { focus?: boolean; pointer?: boolean }) => void;
}) {
  const title = conversationTitle(chat.title);
  const { ask } = chat;
  const send = useAnswer(chat.id, ask?.callId ?? '');
  const armed = useArmed(ask?.callId);
  const [said, setSaid] = useState<string>();

  const sent = send.isPending || send.isSuccess;

  const pick = (answer: string, words: string) => {
    if (!armed || sent) {
      return;
    }

    setSaid(words);
    onChoose(words);
    send.mutate(answer);
  };

  const open = (label: string, variant: 'outline' | 'quiet') => (
    <Button asChild size='sm' variant={variant}>
      <Link
        aria-label={`${label}: ${title}`}
        params={{ id: chat.id }}
        to='/c/$id'
      >
        {label}
      </Link>
    </Button>
  );

  const card = (
    children: React.ReactNode,
    actions: React.ReactNode,
    settled = false
  ) => (
    <li className='pb-1' data-kind='needs'>
      <NeedsYouCard
        actions={actions}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            onInside({ focus: false });
          }
        }}
        onFocus={() => onInside({ focus: true })}
        onPointerEnter={() => onInside({ pointer: true })}
        onPointerLeave={() => onInside({ pointer: false })}
        className={cn('transition-colors', lit && 'bg-muted')}
        glyph={
          settled ? <LiveMark className='size-4' state='thinking' /> : undefined
        }
        label={settled ? '' : undefined}
        title={title}
      >
        {children}
        {send.error && <ErrorMessage>{send.error.message}</ErrorMessage>}
      </NeedsYouCard>
    </li>
  );

  if (sent) {
    return card(
      <p className='text-muted-foreground'>{said}</p>,
      open('Open chat', 'quiet'),
      true
    );
  }

  if (ask?.kind === 'question') {
    return card(
      <>
        <p>{ask.question}</p>
        <QuestionOptions
          disabled={false}
          onPick={(option) => pick(option, `You chose ${option}`)}
          options={ask.options}
        />
      </>,
      open('Open chat', 'quiet')
    );
  }

  if (ask?.kind === 'approval') {
    return card(
      <ApprovalSummary action={ask.action} summary={ask.summary} />,
      <>
        {open('Review', 'outline')}
        <Button
          aria-label={`Deny: ${title}`}
          onClick={() => pick('denied', 'You denied this')}
          size='sm'
          variant='ghost'
        >
          Deny
        </Button>
      </>
    );
  }

  return card(undefined, open('Review', 'outline'));
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

function Running({
  chosen,
  lit,
  now,
  run,
}: {
  chosen: string | undefined;
  lit: boolean;
  now: number;
  run: Run;
}) {
  return (
    <ActivityRow
      className={cn(lit && 'bg-muted')}
      data-kind='running'
      detail={doing(run) ?? chosen}
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
  const unread = useUnreadChats();
  const [had, setHad] = useState(false);
  const [held, setHeld] = useState<number>();
  const [frozen, setFrozen] = useState<Item[]>();
  const [chosen, setChosen] = useState<Record<number, string>>({});
  const inside = useRef({ focus: false, pointer: false });
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

  const live = unread.data ? benchItems(unread.data) : [];

  const items = frozen ?? live;

  if (items.length > 0 && !had) {
    setHad(true);
  }

  const within = (change: { focus?: boolean; pointer?: boolean }) => {
    Object.assign(inside.current, change);

    const stay = inside.current.focus || inside.current.pointer;

    setFrozen((current) => (stay ? (current ?? items) : undefined));
  };

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
          All caught up
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
                onChoose={(said) =>
                  setChosen((current) => ({ ...current, [item.chat.id]: said }))
                }
                onInside={within}
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
              chosen={chosen[item.run.id]}
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
