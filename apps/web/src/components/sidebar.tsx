import { AccountMenu } from '@/components/account-menu';
import { AppLink } from '@/components/artifact-apps';
import { ConversationItem } from '@/components/conversation-item';
import { LabMark } from '@/components/lab-mark';
import { LoadError } from '@/components/load-error';
import { LoadMore } from '@/components/load-more';
import {
  type ProjectEditing,
  ProjectDialog,
} from '@/components/project-dialog';
import { ProjectMenu } from '@/components/project-menu';
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
import { usePins } from '@/lib/artifacts';
import type { User } from '@/lib/auth';
import {
  type ConversationSort,
  useConversationSort,
  useConversationSummary,
  useConversations,
  usePinnedConversations,
} from '@/lib/conversations';
import { usePath } from '@/lib/location';
import { useProjects } from '@/lib/projects';
import { usePersistentState } from '@/lib/storage';
import { cn } from '@/lib/utils';
import {
  ArrowDownUp,
  ChevronDown,
  Clock,
  Folder,
  FolderOpen,
  LibraryBig,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  SquarePen,
} from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import { type ReactNode, useId, useState } from 'react';
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
  subject,
}: {
  collapsed: boolean;
  controls: string;
  onToggle: () => void;
  subject: string;
}) {
  const label = collapsed ? `Show ${subject}` : `Hide ${subject}`;

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

function SectionHeader({
  children,
  collapsed,
  collapsible = true,
  controls,
  onToggle,
  subject,
  title,
}: {
  children?: ReactNode;
  collapsed: boolean;
  collapsible?: boolean;
  controls: string;
  onToggle: () => void;
  subject: string;
  title: string;
}) {
  return (
    <div className='flex items-center gap-1 px-2'>
      <h2 className='text-xs font-medium text-muted-foreground'>{title}</h2>
      {collapsible && (
        <CollapseButton
          collapsed={collapsed}
          controls={controls}
          onToggle={onToggle}
          subject={subject}
        />
      )}
      {children}
    </div>
  );
}

function useCollapsed(key: string) {
  return usePersistentState(key, collapsedSchema, false);
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
  expanded,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  expanded?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-current={active ? 'page' : undefined}
      aria-expanded={expanded}
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

const PREVIEW = 5;

function openProject(path: string, chatProject: number | null | undefined) {
  const match = /^\/projects\/(\d+)$/.exec(path);

  return match ? Number(match[1]) : (chatProject ?? undefined);
}

function ShowMore({ onClick }: { onClick: () => void }) {
  return (
    <button
      className='w-full rounded-lg px-2 py-1.5 text-left text-sm text-muted-foreground outline-none hover:bg-sidebar-accent hover:text-foreground'
      onClick={onClick}
      type='button'
    >
      Show more
    </button>
  );
}

function ProjectChats({
  id,
  onProject,
  onSelect,
  selected,
}: {
  id: number;
  onProject: (id: number) => void;
  onSelect?: () => void;
  selected: number | undefined;
}) {
  const chats = useConversations({ project: id });

  const all = chats.data ?? [];

  return (
    <div className='flex flex-col gap-0.5 pl-7'>
      {all.slice(0, PREVIEW).map((conversation) => (
        <ConversationItem
          key={conversation.id}
          conversation={conversation}
          onSelect={onSelect}
          selected={conversation.id === selected}
        />
      ))}
      {(all.length > PREVIEW || chats.hasNextPage) && (
        <ShowMore onClick={() => onProject(id)} />
      )}
    </div>
  );
}

function ProjectsSection({
  onProject,
  onSelect,
  selected,
}: {
  onProject: (id: number) => void;
  onSelect?: () => void;
  selected: number | undefined;
}) {
  const list = useId();
  const path = usePath();
  const projects = useProjects();
  const summary = useConversationSummary(selected);

  const [collapsed, setCollapsed] = useCollapsed('projects-collapsed');

  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState<ProjectEditing>();
  const [closed, setClosed] = useState<number>();

  const open = openProject(path, summary.data?.projectId);

  const [previous, setPrevious] = useState(open);

  if (open !== previous) {
    setPrevious(open);
    setClosed(undefined);
  }

  const showing = closed === open ? undefined : open;

  const select = (id: number) => {
    if (id !== open) {
      setClosed(undefined);
      onProject(id);
      return;
    }

    setClosed(closed === open ? undefined : open);
  };

  const all = projects.data?.projects ?? [];

  const shown = expanded
    ? all
    : all.filter((project, index) => index < PREVIEW || project.id === open);

  return (
    <div className='flex flex-col gap-1'>
      <SectionHeader
        collapsed={collapsed}
        collapsible={all.length > 0}
        controls={list}
        onToggle={() => setCollapsed(!collapsed)}
        subject='projects'
        title='Projects'
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              aria-label='New project'
              className={cn(headerButton, 'ml-auto')}
              onClick={() => setEditing({ kind: 'new' })}
              type='button'
            >
              <Plus aria-hidden='true' className='size-3.5' />
            </button>
          </TooltipTrigger>
          <TooltipContent>New project</TooltipContent>
        </Tooltip>
      </SectionHeader>
      <nav
        aria-label='Projects'
        className='flex flex-col gap-0.5'
        hidden={collapsed}
        id={list}
      >
        {projects.isError && <LoadError className='px-2' subject='projects' />}
        {shown.map((project) => {
          const Icon = project.id === showing ? FolderOpen : Folder;

          return (
            <div key={project.id} className='flex flex-col gap-0.5'>
              <div className='group relative flex items-center'>
                <NavButton
                  active={path === `/projects/${project.id}`}
                  expanded={
                    project.id === open ? project.id === showing : undefined
                  }
                  onClick={() => select(project.id)}
                >
                  <Icon aria-hidden='true' className='size-4 shrink-0' />
                  <span className='truncate pr-6'>{project.name}</span>
                </NavButton>
                <ProjectMenu
                  className='absolute right-1 p-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100'
                  onRename={() => setEditing({ kind: 'rename', project })}
                  project={project}
                />
              </div>
              {project.id === showing && (
                <ProjectChats
                  id={project.id}
                  onProject={onProject}
                  onSelect={onSelect}
                  selected={selected}
                />
              )}
            </div>
          );
        })}
        {!expanded && all.length > shown.length && (
          <ShowMore onClick={() => setExpanded(true)} />
        )}
      </nav>
      <ProjectDialog
        editing={editing}
        onClose={() => setEditing(undefined)}
        onCreated={(project) => onProject(project.id)}
      />
    </div>
  );
}

function AppsSection({ onSelect }: { onSelect?: () => void }) {
  const list = useId();
  const apps = usePins(null);

  const [collapsed, setCollapsed] = useCollapsed('apps-collapsed');

  if (apps.isError) {
    return <LoadError className='px-2' subject='apps' />;
  }

  if ((apps.data?.length ?? 0) === 0) {
    return null;
  }

  return (
    <div className='flex flex-col gap-1'>
      <SectionHeader
        collapsed={collapsed}
        controls={list}
        onToggle={() => setCollapsed(!collapsed)}
        subject='apps'
        title='Apps'
      />
      <nav
        aria-label='Apps'
        className='flex flex-col gap-0.5'
        hidden={collapsed}
        id={list}
      >
        {apps.data?.map((app) => (
          <AppLink
            key={`${app.conversationId}/${app.artifactId}`}
            app={app}
            onSelect={onSelect}
          />
        ))}
      </nav>
    </div>
  );
}

function PinnedSection({
  onSelect,
  selected,
}: {
  onSelect?: () => void;
  selected: number | undefined;
}) {
  const list = useId();
  const pinned = usePinnedConversations();

  const [collapsed, setCollapsed] = useCollapsed('pinned-collapsed');

  if (pinned.isError) {
    return <LoadError className='px-2' subject='pinned chats' />;
  }

  if ((pinned.data?.length ?? 0) === 0) {
    return null;
  }

  return (
    <div className='flex flex-col gap-1'>
      <SectionHeader
        collapsed={collapsed}
        controls={list}
        onToggle={() => setCollapsed(!collapsed)}
        subject='pinned chats'
        title='Pinned'
      >
        <SortMenu />
      </SectionHeader>
      <nav
        aria-label='Pinned chats'
        className='flex flex-col gap-1'
        hidden={collapsed}
        id={list}
      >
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
  );
}

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
  const list = useId();
  const path = usePath();

  const [collapsed, setCollapsed] = useCollapsed('recents-collapsed');

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
      <ProjectsSection
        onProject={onProject}
        onSelect={onSelect}
        selected={selected}
      />
      <AppsSection onSelect={onSelect} />
      <PinnedSection onSelect={onSelect} selected={selected} />
      <div className='flex min-h-0 flex-col gap-1'>
        {(error || (conversations?.length ?? 0) > 0) && (
          <SectionHeader
            collapsed={collapsed}
            controls={list}
            onToggle={() => setCollapsed(!collapsed)}
            subject='chats'
            title='Recents'
          >
            <SortMenu />
          </SectionHeader>
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
