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
import {
  conversationTitle,
  conversationsQueryKey,
  readConversation,
  useUnreadChats,
} from '@/lib/conversations';
import { ago } from '@/lib/time';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { LoaderCircle, X } from 'lucide-react';

const VISIBLE = 3;

type Chat = {
  finishedAt: string;
  id: number;
  preview: string;
  scheduled: boolean;
  title: string | null;
};

function Dot() {
  return (
    <span
      aria-hidden='true'
      className='size-2 shrink-0 rounded-full bg-foreground'
    />
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
            className='flex h-8 items-center gap-2 rounded-full pl-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/50'
            onClick={onOpen}
            type='button'
          >
            <Dot />
            <span className='max-w-40 truncate font-medium'>{title}</span>
          </button>
        </HoverCardTrigger>
        <button
          aria-label={`Mark ${title} as read`}
          className='relative mr-1 grid h-6 min-w-6 place-items-center rounded-full px-2 text-muted-foreground tabular-nums outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50'
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
          className='flex h-8 items-center rounded-full bg-muted px-3 text-sm font-medium tabular-nums transition-colors outline-none hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring/50'
          type='button'
        >
          +{chats.length}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='center' className='w-72'>
        {chats.map((chat) => (
          <DropdownMenuItem key={chat.id} onSelect={() => onOpen(chat.id)}>
            <Dot />
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

  if (chats.length === 0) {
    return null;
  }

  const open = (id: number) => navigate({ params: { id }, to: '/c/$id' });

  const rest = chats.slice(VISIBLE);

  return (
    <ul
      aria-label='Finished while you were away'
      className='absolute inset-x-0 top-full mt-4 flex animate-in flex-wrap justify-center gap-1.5 duration-200 fade-in slide-in-from-top-1'
    >
      {chats.slice(0, VISIBLE).map((chat) => (
        <li key={chat.id}>
          <Chip
            chat={chat}
            onOpen={() => void open(chat.id)}
            onRead={() => read.mutate(chat.id)}
          />
        </li>
      ))}
      {rest.length > 0 && (
        <li>
          <More chats={rest} onOpen={(id) => void open(id)} />
        </li>
      )}
      {running > 0 && (
        <li className='flex h-8 items-center gap-2 rounded-full px-3 text-sm text-muted-foreground tabular-nums ring-1 ring-border ring-inset'>
          <LoaderCircle
            aria-hidden='true'
            className='size-3.5 motion-safe:animate-spin'
          />
          {running} running
        </li>
      )}
    </ul>
  );
}
