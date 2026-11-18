import { AccountMenu } from '@/components/account-menu';
import { LabMark } from '@/components/lab-mark';
import { useSearch } from '@/components/search';
import { SidebarRow } from '@/components/sidebar-row';
import {
  AppsSection,
  PinnedSection,
  ProjectsSection,
  RecentsSection,
} from '@/components/sidebar-sections';
import { Dot } from '@/components/ui/dot';
import { Kbd } from '@/components/ui/kbd';
import { LiveMark } from '@/components/ui/live-mark';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { User } from '@/lib/auth';
import { useConversations, useUnreadChats } from '@/lib/conversations';
import { usePath } from '@/lib/location';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { useQuiet } from '@/lib/voice';
import {
  Clock,
  LibraryBig,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  SquarePen,
} from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { type AnimationEvent, type ReactNode, useState } from 'react';

type Side = 'bottom' | 'right';

function RailButton({
  active = false,
  children,
  label,
  onClick,
  shortcut,
  side = 'bottom',
}: {
  active?: boolean;
  children: ReactNode;
  label: string;
  onClick: () => void;
  shortcut?: { keys: string; label: string };
  side?: Side;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-keyshortcuts={shortcut?.keys}
          aria-label={label}
          className={cn(
            'flex size-9 items-center justify-center rounded-lg text-sidebar-foreground hover:bg-sidebar-accent',
            active && 'bg-sidebar-accent text-sidebar-accent-foreground'
          )}
          onClick={onClick}
          type='button'
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side={side}>
        {label}
        {shortcut && <Kbd>{shortcut.label}</Kbd>}
      </TooltipContent>
    </Tooltip>
  );
}

function SearchButton({ side }: { side?: Side }) {
  const { openSearch } = useSearch();

  return (
    <RailButton
      label='Search'
      onClick={openSearch}
      shortcut={{ keys: 'Meta+K', label: '⌘K' }}
      side={side}
    >
      <Search aria-hidden='true' className='size-4' />
    </RailButton>
  );
}

const navPages = [
  { icon: SquarePen, label: 'New chat', to: '/' },
  { icon: Clock, label: 'Scheduled', to: '/scheduled' },
  { icon: LibraryBig, label: 'Library', to: '/library' },
] as const;

export type NavPath = (typeof navPages)[number]['to'];

function newestFinish(
  chats: readonly { finishedAt: string; id: number }[] | undefined,
  selected: number | undefined
) {
  return chats && (chats.find(({ id }) => id !== selected)?.finishedAt ?? '');
}

function railState(hop: boolean, working: boolean) {
  if (hop) {
    return 'done';
  }

  return working ? 'thinking' : 'idle';
}

function RailMark({
  onToggle,
  selected,
}: {
  onToggle: () => void;
  selected: number | undefined;
}) {
  const unread = useUnreadChats();
  const reduced = useReducedMotion();
  const quiet = useQuiet();

  const working = (unread.data?.running ?? 0) > 0;

  const attention =
    (unread.data?.chats.length ?? 0) + (unread.data?.waiting.length ?? 0) > 0;

  const newest = newestFinish(unread.data?.chats, selected);

  const [seen, setSeen] = useState(newest);
  const [hop, setHop] = useState(false);

  if (seen !== newest) {
    setSeen(newest);
    setHop(
      !quiet &&
        !reduced &&
        seen !== undefined &&
        newest !== undefined &&
        newest > seen
    );
  }

  const landed = (event: AnimationEvent) => {
    if (
      event.target instanceof Element &&
      event.target.matches('[data-part=sparkle]')
    ) {
      setHop(false);
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-label='Expand sidebar'
          className='group/mark relative flex size-9 items-center justify-center rounded-lg hover:bg-sidebar-accent'
          onClick={onToggle}
          type='button'
        >
          <LiveMark
            className='size-6 transition-opacity group-hover/mark:opacity-0 group-focus-visible/mark:opacity-0'
            onAnimationEnd={landed}
            state={railState(hop, working)}
          />
          <PanelLeftOpen
            aria-hidden='true'
            className='absolute size-4 opacity-0 transition-opacity group-hover/mark:opacity-100 group-focus-visible/mark:opacity-100'
          />
          <AnimatePresence initial={false}>
            {attention && (
              <m.span
                animate={{ scale: 1 }}
                className='absolute top-1 right-1 flex'
                initial={quiet ? false : { scale: 0 }}
                transition={{ ...spring.pop, delay: hop ? 0.74 : 0 }}
              >
                <Dot tone='attention' />
              </m.span>
            )}
          </AnimatePresence>
        </button>
      </TooltipTrigger>
      <TooltipContent side='right'>Expand sidebar</TooltipContent>
    </Tooltip>
  );
}

function SidebarRail({
  onNavigate,
  onToggle,
  selected,
  user,
}: {
  onNavigate: (to: NavPath) => void;
  onToggle: () => void;
  selected: number | undefined;
  user: User;
}) {
  const path = usePath();

  return (
    <aside className='flex h-full w-14 flex-col items-center gap-2 bg-sidebar py-3 text-sidebar-foreground'>
      <RailMark onToggle={onToggle} selected={selected} />
      <SearchButton side='right' />
      {navPages.map(({ icon: Icon, label, to }) => (
        <RailButton
          key={to}
          active={path === to}
          label={label}
          onClick={() => onNavigate(to)}
          side='right'
        >
          <Icon aria-hidden='true' className='size-4' />
        </RailButton>
      ))}
      <div className='mt-auto'>
        <AccountMenu compact user={user} />
      </div>
    </aside>
  );
}

export function Sidebar({
  collapsed = false,
  selected,
  onNavigate,
  onProject,
  onSelect,
  onToggle,
  user,
}: {
  collapsed?: boolean;
  selected: number | undefined;
  onNavigate: (to: NavPath) => void;
  onProject: (id: number) => void;
  onSelect?: () => void;
  onToggle?: () => void;
  user: User;
}) {
  const conversations = useConversations();

  const rail = collapsed && onToggle !== undefined;

  const loadMore =
    conversations.hasNextPage && !conversations.isFetchingNextPage
      ? () => void conversations.fetchNextPage()
      : undefined;

  return (
    <AnimatePresence initial={false} mode='wait'>
      <m.div
        key={rail ? 'rail' : 'full'}
        animate={{ opacity: 1 }}
        className='h-full bg-sidebar'
        exit={{ opacity: 0 }}
        initial={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        <SidebarContent
          conversations={conversations.data}
          error={conversations.isError}
          onLoadMore={loadMore}
          onNavigate={onNavigate}
          onProject={onProject}
          onSelect={onSelect}
          onToggle={onToggle}
          rail={rail}
          selected={selected}
          user={user}
        />
      </m.div>
    </AnimatePresence>
  );
}

function SidebarContent({
  rail,
  ...props
}: Parameters<typeof SidebarPanel>[0] & { rail: boolean }) {
  if (rail && props.onToggle) {
    return (
      <SidebarRail
        onNavigate={props.onNavigate}
        onToggle={props.onToggle}
        selected={props.selected}
        user={props.user}
      />
    );
  }

  return <SidebarPanel {...props} />;
}

function SidebarPanel({
  conversations,
  error,
  onLoadMore,
  onNavigate,
  onProject,
  onSelect,
  onToggle,
  selected,
  user,
}: {
  conversations: ReturnType<typeof useConversations>['data'];
  error: boolean;
  onLoadMore: (() => void) | undefined;
  onNavigate: (to: NavPath) => void;
  onProject: (id: number) => void;
  onSelect?: () => void;
  onToggle: (() => void) | undefined;
  selected: number | undefined;
  user: User;
}) {
  const path = usePath();

  return (
    <aside className='flex h-full min-w-52 flex-col gap-4 bg-sidebar p-3 text-sidebar-foreground'>
      <div className='flex items-center justify-between px-1'>
        <button
          aria-label='New chat'
          className='flex rounded-md'
          onClick={() => onNavigate('/')}
          type='button'
        >
          <LabMark className='size-6' />
        </button>
        <div className='flex items-center gap-1'>
          <SearchButton />
          {onToggle && (
            <RailButton label='Collapse sidebar' onClick={onToggle}>
              <PanelLeftClose aria-hidden='true' className='size-4' />
            </RailButton>
          )}
        </div>
      </div>
      <ul className='flex flex-col gap-0.5'>
        {navPages.map(({ icon: Icon, label, to }) => (
          <SidebarRow key={to} asChild selected={path === to}>
            <button
              aria-current={path === to ? 'page' : undefined}
              onClick={() => onNavigate(to)}
              type='button'
            >
              <Icon aria-hidden='true' />
              {label}
            </button>
          </SidebarRow>
        ))}
      </ul>
      <div className='-mx-3 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3'>
        <ProjectsSection
          onProject={onProject}
          onSelect={onSelect}
          selected={selected}
        />
        <AppsSection onSelect={onSelect} />
        <PinnedSection onSelect={onSelect} selected={selected} />
        <RecentsSection
          conversations={conversations}
          error={error}
          onLoadMore={onLoadMore}
          onSelect={onSelect}
          selected={selected}
        />
      </div>
      <AccountMenu user={user} />
    </aside>
  );
}
