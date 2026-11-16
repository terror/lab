import { AccountMenu } from '@/components/account-menu';
import { ConversationItem } from '@/components/conversation-item';
import { LabMark } from '@/components/lab-mark';
import { useSearch } from '@/components/search';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { conversationsQueryOptions } from '@/lib/conversations';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { PanelLeftClose, PanelLeftOpen, Search, SquarePen } from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import type { ReactNode } from 'react';

type User = { email: string; id: string; image?: string | null; name: string };

type Side = 'bottom' | 'right';

function RailButton({
  active = false,
  children,
  label,
  onClick,
  side = 'bottom',
}: {
  active?: boolean;
  children: ReactNode;
  label: string;
  onClick: () => void;
  side?: Side;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-label={label}
          className={cn(
            'flex size-9 items-center justify-center rounded-lg text-sidebar-foreground outline-none hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-ring/50',
            active && 'bg-sidebar-accent text-sidebar-accent-foreground'
          )}
          onClick={onClick}
          type='button'
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}

function SearchButton({ side }: { side?: Side }) {
  const { openSearch } = useSearch();

  return (
    <RailButton label='Search (⌘K)' onClick={openSearch} side={side}>
      <Search aria-hidden='true' className='size-4' />
    </RailButton>
  );
}

function SidebarRail({
  onNewChat,
  onToggle,
  selected,
  user,
}: {
  onNewChat: () => void;
  onToggle: () => void;
  selected: number | undefined;
  user: User;
}) {
  return (
    <aside className='flex h-full w-14 flex-col items-center gap-2 bg-sidebar py-3 text-sidebar-foreground'>
      <RailButton label='Expand sidebar' onClick={onToggle} side='right'>
        <PanelLeftOpen aria-hidden='true' className='size-4' />
      </RailButton>
      <SearchButton side='right' />
      <RailButton
        active={selected === undefined}
        label='New chat'
        onClick={onNewChat}
        side='right'
      >
        <SquarePen aria-hidden='true' className='size-4' />
      </RailButton>
      <div className='mt-auto'>
        <AccountMenu compact user={user} />
      </div>
    </aside>
  );
}

export function Sidebar({
  collapsed = false,
  selected,
  onNewChat,
  onSelect,
  onToggle,
  user,
}: {
  collapsed?: boolean;
  selected: number | undefined;
  onNewChat: () => void;
  onSelect: (id: number) => void;
  onToggle?: () => void;
  user: User;
}) {
  const conversations = useQuery(conversationsQueryOptions);

  const rail = collapsed && onToggle !== undefined;

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
          onNewChat={onNewChat}
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
        onNewChat={props.onNewChat}
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
  onNewChat,
  onSelect,
  onToggle,
  selected,
  user,
}: {
  conversations: { id: number; title: string | null }[] | undefined;
  error: boolean;
  onNewChat: () => void;
  onSelect: (id: number) => void;
  onToggle: (() => void) | undefined;
  selected: number | undefined;
  user: User;
}) {
  return (
    <aside className='flex h-full min-w-52 flex-col gap-4 bg-sidebar p-3 text-sidebar-foreground'>
      <div className='flex items-center justify-between px-1'>
        <LabMark className='size-6' />
        <div className='flex items-center gap-1'>
          <SearchButton />
          {onToggle && (
            <RailButton label='Collapse sidebar' onClick={onToggle}>
              <PanelLeftClose aria-hidden='true' className='size-4' />
            </RailButton>
          )}
        </div>
      </div>
      <button
        aria-current={selected === undefined ? 'page' : undefined}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors outline-none hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-ring/50',
          selected === undefined &&
            'bg-sidebar-accent text-sidebar-accent-foreground'
        )}
        onClick={onNewChat}
        type='button'
      >
        <SquarePen aria-hidden='true' className='size-4' />
        New chat
      </button>
      <nav
        aria-label='Chats'
        className='flex min-h-0 flex-col gap-1 overflow-y-auto'
      >
        {error && (
          <p role='alert' className='px-2 text-sm text-destructive'>
            Unable to load chats.
          </p>
        )}
        {conversations?.map((conversation) => (
          <ConversationItem
            key={conversation.id}
            conversation={conversation}
            onSelect={onSelect}
            selected={conversation.id === selected}
          />
        ))}
      </nav>
      <div className='mt-auto'>
        <AccountMenu user={user} />
      </div>
    </aside>
  );
}
