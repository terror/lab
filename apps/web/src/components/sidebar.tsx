import { AccountMenu } from '@/components/account-menu';
import { ConversationItem } from '@/components/conversation-item';
import { LabMark } from '@/components/lab-mark';
import { LoadError } from '@/components/load-error';
import { LoadMore } from '@/components/load-more';
import { useSearch } from '@/components/search';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Kbd } from '@/components/ui/kbd';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { User } from '@/lib/auth';
import {
  type ConversationSort,
  useConversationSort,
  useConversations,
  usePinnedConversations,
} from '@/lib/conversations';
import { usePath } from '@/lib/location';
import { usePersistentState } from '@/lib/storage';
import { cn } from '@/lib/utils';
import {
  ArrowDownUp,
  ChevronDown,
  Clock,
  LibraryBig,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  SquarePen,
} from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import { type ReactNode, useId } from 'react';
import { z } from 'zod';

type Side = 'bottom' | 'right';

const collapsedSchema = z.boolean();

const headerButton =
  'flex size-6 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-sidebar-accent hover:text-foreground';

const sorts: { label: string; value: ConversationSort }[] = [
  { label: 'Recent activity', value: 'activity' },
  { label: 'Date created', value: 'created' },
  { label: 'Title', value: 'title' },
];

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
            'flex size-9 items-center justify-center rounded-lg text-sidebar-foreground outline-none hover:bg-sidebar-accent',
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

function CollapseButton({
  collapsed,
  controls,
  onToggle,
}: {
  collapsed: boolean;
  controls: string;
  onToggle: () => void;
}) {
  const label = collapsed ? 'Show chats' : 'Hide chats';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-controls={controls}
          aria-expanded={!collapsed}
          aria-label={label}
          className={headerButton}
          onClick={onToggle}
          type='button'
        >
          <ChevronDown
            aria-hidden='true'
            className={cn(
              'size-3.5 transition-transform',
              collapsed && '-rotate-90'
            )}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function SortMenu() {
  const [sort, setSort] = useConversationSort();

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              aria-label='Sort chats'
              className={cn(headerButton, 'ml-auto')}
              type='button'
            >
              <ArrowDownUp aria-hidden='true' className='size-3.5' />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Sort chats</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align='end' className='min-w-44'>
        <DropdownMenuLabel>Sort by</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          onValueChange={(value) => {
            const choice = sorts.find((candidate) => candidate.value === value);

            if (choice) {
              setSort(choice.value);
            }
          }}
          value={sort}
        >
          {sorts.map(({ label, value }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NavButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors outline-none hover:bg-sidebar-accent',
        active && 'bg-sidebar-accent text-sidebar-accent-foreground'
      )}
      onClick={onClick}
      type='button'
    >
      {children}
    </button>
  );
}

export const navPages = [
  { icon: SquarePen, label: 'New chat', to: '/' },
  { icon: Clock, label: 'Scheduled', to: '/scheduled' },
  { icon: LibraryBig, label: 'Library', to: '/library' },
] as const;

export type NavPath = (typeof navPages)[number]['to'];

function SidebarRail({
  onNavigate,
  onToggle,
  user,
}: {
  onNavigate: (to: NavPath) => void;
  onToggle: () => void;
  user: User;
}) {
  const path = usePath();

  return (
    <aside className='flex h-full w-14 flex-col items-center gap-2 bg-sidebar py-3 text-sidebar-foreground'>
      <RailButton label='Expand sidebar' onClick={onToggle} side='right'>
        <PanelLeftOpen aria-hidden='true' className='size-4' />
      </RailButton>
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
  onSelect,
  onToggle,
  user,
}: {
  collapsed?: boolean;
  selected: number | undefined;
  onNavigate: (to: NavPath) => void;
  onSelect: (id: number) => void;
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
  onSelect,
  onToggle,
  selected,
  user,
}: {
  conversations:
    | { id: number; pinned: boolean; running: boolean; title: string | null }[]
    | undefined;
  error: boolean;
  onLoadMore: (() => void) | undefined;
  onNavigate: (to: NavPath) => void;
  onSelect: (id: number) => void;
  onToggle: (() => void) | undefined;
  selected: number | undefined;
  user: User;
}) {
  const list = useId();
  const path = usePath();
  const pinned = usePinnedConversations();

  const [collapsed, setCollapsed] = usePersistentState(
    'recents-collapsed',
    collapsedSchema,
    false
  );

  return (
    <aside className='flex h-full min-w-52 flex-col gap-4 bg-sidebar p-3 text-sidebar-foreground'>
      <div className='flex items-center justify-between px-1'>
        <button
          aria-label='New chat'
          className='flex rounded-md outline-none'
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
      <div className='flex flex-col gap-0.5'>
        {navPages.map(({ icon: Icon, label, to }) => (
          <NavButton
            key={to}
            active={path === to}
            onClick={() => onNavigate(to)}
          >
            <Icon aria-hidden='true' className='size-4' />
            {label}
          </NavButton>
        ))}
      </div>
      {(pinned.data?.length ?? 0) > 0 && (
        <div className='flex flex-col gap-1'>
          <h2 className='px-2 text-xs font-medium text-muted-foreground'>
            Pinned
          </h2>
          <nav aria-label='Pinned chats' className='flex flex-col gap-1'>
            {pinned.data?.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                onSelect={onSelect}
                selected={conversation.id === selected}
              />
            ))}
          </nav>
        </div>
      )}
      <div className='flex min-h-0 flex-col gap-1'>
        {(error || (conversations?.length ?? 0) > 0) && (
          <div className='flex items-center gap-1 px-2'>
            <h2 className='text-xs font-medium text-muted-foreground'>
              Recents
            </h2>
            <CollapseButton
              collapsed={collapsed}
              controls={list}
              onToggle={() => setCollapsed(!collapsed)}
            />
            <SortMenu />
          </div>
        )}
        <nav
          aria-label='Chats'
          className='flex min-h-0 flex-col gap-1 overflow-y-auto'
          hidden={collapsed}
          id={list}
        >
          {error && <LoadError className='px-2' subject='chats' />}
          {conversations?.map((conversation) => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              onSelect={onSelect}
              selected={conversation.id === selected}
            />
          ))}
          {onLoadMore && <LoadMore onLoadMore={onLoadMore} />}
        </nav>
      </div>
      <div className='mt-auto'>
        <AccountMenu user={user} />
      </div>
    </aside>
  );
}
