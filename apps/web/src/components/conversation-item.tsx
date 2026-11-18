import {
  ChatMenuItems,
  RenameInput,
  contextParts,
  dropdownParts,
  useChatActions,
  useRenaming,
} from '@/components/chat-actions';
import {
  MotionSidebarRow,
  rowAction,
  useRowPresence,
} from '@/components/sidebar-row';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Dot } from '@/components/ui/dot';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LiveMark } from '@/components/ui/live-mark';
import { conversationTitle } from '@/lib/conversations';
import { useHandoff } from '@/lib/handoff';
import { stagger } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { Link } from '@tanstack/react-router';
import { Ellipsis } from 'lucide-react';
import {
  type AnimationEvent,
  type CSSProperties,
  Fragment,
  type ReactNode,
  useState,
} from 'react';

type Activity = 'idle' | 'running' | 'unread' | 'waiting';

const indicators: Record<
  Activity,
  { attention: boolean; label: string; mark: ReactNode } | undefined
> = {
  idle: undefined,
  running: {
    attention: false,
    label: 'Running',
    mark: <LiveMark className='size-3.5' state='thinking' />,
  },
  unread: { attention: true, label: 'Unread', mark: <Dot tone='attention' /> },
  waiting: {
    attention: true,
    label: 'Needs you',
    mark: <Dot tone='attention' />,
  },
};

function activity(
  {
    running,
    unread,
    waiting,
  }: { running: boolean; unread: boolean; waiting: boolean },
  selected: boolean
): Activity {
  if (waiting) {
    return 'waiting';
  }

  if (running) {
    return 'running';
  }

  return unread && !selected ? 'unread' : 'idle';
}

function Title({ arrived, title }: { arrived: boolean; title: string }) {
  if (!arrived) {
    return <span className='truncate'>{title}</span>;
  }

  return (
    <span className='truncate'>
      {title.split(' ').map((word, index) => (
        <Fragment key={index}>
          {index > 0 && ' '}
          <span
            className='motion-safe:animate-word-in'
            style={{ animationDelay: `${Math.min(index, 5) * stagger}s` }}
          >
            {word}
          </span>
        </Fragment>
      ))}
    </span>
  );
}

export function ConversationItem({
  conversation,
  onSelect,
  selected,
}: {
  conversation: {
    id: number;
    pinned: boolean;
    projectId: number | null;
    running: boolean;
    title: string | null;
    unread: boolean;
    waiting: boolean;
  };
  onSelect?: () => void;
  selected: boolean;
}) {
  const presence = useRowPresence();
  const renaming = useRenaming();
  const actions = useChatActions(conversation, selected);

  const current = activity(conversation, selected);

  const [order, settle] = useHandoff(current);
  const [named, setNamed] = useState(conversation.title);
  const [arrived, setArrived] = useState(false);

  const title = conversationTitle(conversation.title);

  if (named !== conversation.title) {
    setNamed(conversation.title);
    setArrived(named === null);
  }

  if (renaming.editing) {
    return (
      <li>
        <RenameInput
          initial={title}
          onCancel={renaming.stop}
          onSubmit={(value) => {
            renaming.stop();
            actions.rename(value);
          }}
        />
      </li>
    );
  }

  const indicator = indicators[current];

  const landed = (event: AnimationEvent) => {
    if (
      event.target instanceof Element &&
      event.target.matches('[data-part=dot]')
    ) {
      settle();
    }
  };

  const mark =
    order === undefined ? (
      indicator?.mark
    ) : (
      <LiveMark
        className='size-3.5'
        onAnimationEnd={landed}
        state='handoff'
        style={{ '--live-mark-delay': `${order * stagger}s` } as CSSProperties}
      />
    );

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <MotionSidebarRow
          {...presence}
          actions={
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label={`Options for ${title}`}
                  className={rowAction}
                  type='button'
                >
                  <Ellipsis aria-hidden='true' />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align='start'
                onCloseAutoFocus={renaming.onCloseAutoFocus}
              >
                <ChatMenuItems
                  {...actions.menu}
                  onRename={renaming.start}
                  parts={dropdownParts}
                />
              </DropdownMenuContent>
            </DropdownMenu>
          }
          asChild
          className={cn(
            arrived && 'animate-title-wash',
            indicator?.attention && 'font-medium'
          )}
          selected={selected}
          status={mark}
        >
          <Link
            aria-current={selected ? 'page' : undefined}
            onClick={onSelect}
            params={{ id: conversation.id }}
            to='/c/$id'
          >
            <Title arrived={arrived} title={title} />
            {indicator && <span className='sr-only'>{indicator.label}</span>}
          </Link>
        </MotionSidebarRow>
      </ContextMenuTrigger>
      <ContextMenuContent onCloseAutoFocus={renaming.onCloseAutoFocus}>
        <ChatMenuItems
          {...actions.menu}
          onRename={renaming.start}
          parts={contextParts}
        />
      </ContextMenuContent>
    </ContextMenu>
  );
}
