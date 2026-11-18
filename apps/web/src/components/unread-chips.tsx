import { Dot } from '@/components/ui/dot';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { LiveMark } from '@/components/ui/live-mark';
import {
  conversationTitle,
  conversationsQueryKey,
  readConversation,
  useUnreadChats,
} from '@/lib/conversations';
import { rise } from '@/lib/motion';
import { ago } from '@/lib/time';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { X } from 'lucide-react';
import { m } from 'motion/react';

const VISIBLE = 3;

type Chat = {
  finishedAt: string;
  id: number;
  preview: string;
  scheduled: boolean;
  title: string | null;
};

function NeedsYou({
  onOpen,
  title,
}: {
  onOpen: () => void;
  title: string | null;
}) {
  return (
    <button
      className='flex h-8 items-center gap-2 rounded-full bg-muted px-3 text-sm transition-colors hover:bg-foreground/10'
      onClick={onOpen}
      type='button'
    >
      <Dot tone='attention' />
      <span className='max-w-40 truncate font-medium'>
        {conversationTitle(title)}
      </span>{' '}
      <span className='text-muted-foreground'>Needs you</span>
    </button>
  );
}

function Chip({
  chat,
  onOpen,
  onRead,
}: {
  chat: Chat;
  onOpen: () => void;
  onRead: () => void;
}) {
  const title = conversationTitle(chat.title);

  const when = [chat.scheduled && 'Scheduled', `${ago(chat.finishedAt)} ago`]
    .filter(Boolean)
    .join(' · ');

  return (
    <HoverCard closeDelay={100} openDelay={300}>
      <div className='group flex h-8 items-center rounded-full bg-muted text-sm transition-colors hover:bg-foreground/10'>
        <HoverCardTrigger asChild>
          <button
            className='flex h-8 items-center gap-2 rounded-full pl-3'
            onClick={onOpen}
            type='button'
          >
            <Dot tone='attention' />
            <span className='max-w-40 truncate font-medium'>{title}</span>
          </button>
        </HoverCardTrigger>
        <button
          aria-label={`Mark ${title} as read`}
          className='relative mr-1 grid h-6 min-w-6 place-items-center rounded-full px-2 text-muted-foreground tabular-nums hover:text-foreground'
          onClick={onRead}
          type='button'
        >
          <span className='group-focus-within:invisible group-hover:invisible'>
            {ago(chat.finishedAt)}
          </span>
          <X
            aria-hidden='true'
            className='invisible absolute size-3.5 group-focus-within:visible group-hover:visible'
          />
        </button>
      </div>
      <HoverCardContent align='start' className='flex w-80 flex-col gap-1'>
        <div className='flex items-baseline gap-2'>
          <span className='min-w-0 flex-1 truncate font-medium'>{title}</span>
          <span className='shrink-0 text-xs text-muted-foreground'>{when}</span>
        </div>
        {chat.preview && (
          <p className='line-clamp-2 text-muted-foreground'>{chat.preview}</p>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

function More({
  chats,
  onOpen,
}: {
  chats: Chat[];
  onOpen: (id: number) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={`${chats.length} more finished chats`}
          className='flex h-8 items-center rounded-full bg-muted px-3 text-sm font-medium tabular-nums transition-colors hover:bg-foreground/10'
          type='button'
        >
          +{chats.length}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='center' className='w-72'>
        {chats.map((chat) => (
          <DropdownMenuItem key={chat.id} onSelect={() => onOpen(chat.id)}>
            <Dot tone='attention' />
            <span className='min-w-0 flex-1 truncate'>
              {conversationTitle(chat.title)}
            </span>
            <span className='text-xs text-muted-foreground tabular-nums'>
              {ago(chat.finishedAt)}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function UnreadChips() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const unread = useUnreadChats();

  const read = useMutation({
    mutationFn: readConversation,
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: conversationsQueryKey }),
  });

  const chats = unread.data?.chats ?? [];

  const running = unread.data?.running ?? 0;

  const waiting = unread.data?.waiting ?? [];

  if (chats.length === 0 && running === 0 && waiting.length === 0) {
    return null;
  }

  const open = (id: number) => navigate({ params: { id }, to: '/c/$id' });

  const shown = chats.slice(0, VISIBLE);

  const rest = chats.slice(VISIBLE);

  return (
    <ul
      aria-label='While you were away'
      className='flex flex-wrap justify-center gap-1.5'
    >
      {waiting.map((chat, index) => (
        <m.li key={chat.id} {...rise(index)}>
          <NeedsYou onOpen={() => void open(chat.id)} title={chat.title} />
        </m.li>
      ))}
      {shown.map((chat, index) => (
        <m.li key={chat.id} {...rise(waiting.length + index)}>
          <Chip
            chat={chat}
            onOpen={() => void open(chat.id)}
            onRead={() => read.mutate(chat.id)}
          />
        </m.li>
      ))}
      {rest.length > 0 && (
        <m.li {...rise(waiting.length + shown.length)}>
          <More chats={rest} onOpen={(id) => void open(id)} />
        </m.li>
      )}
      {running > 0 && (
        <m.li
          {...rise(waiting.length + shown.length + 1)}
          className='flex h-8 items-center gap-2 rounded-full px-3 text-sm text-muted-foreground tabular-nums ring-1 ring-border ring-inset'
        >
          <LiveMark className='size-3.5' state='thinking' />
          {running} running
        </m.li>
      )}
    </ul>
  );
}
