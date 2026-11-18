import { AppLink } from '@/components/artifact-apps';
import { ConversationItem } from '@/components/conversation-item';
import { LoadError } from '@/components/load-error';
import { LoadMore } from '@/components/load-more';
import {
  type ProjectEditing,
  ProjectDialog,
} from '@/components/project-dialog';
import { ProjectMenu } from '@/components/project-menu';
import {
  MotionSidebarRow,
  SidebarRow,
  rowAction,
  useRowPresence,
} from '@/components/sidebar-row';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { usePins } from '@/lib/artifacts';
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
import { useParams } from '@tanstack/react-router';
import {
  ArrowDownUp,
  ChevronDown,
  Folder,
  FolderOpen,
  Plus,
} from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import {
  type ComponentProps,
  Fragment,
  type ReactNode,
  useId,
  useState,
} from 'react';
import { z } from 'zod';

const collapsedSchema = z.boolean();

const sorts: { label: string; value: ConversationSort }[] = [
  { label: 'Recent activity', value: 'activity' },
  { label: 'Date created', value: 'created' },
  { label: 'Title', value: 'title' },
];

function HeaderButton({
  className,
  label,
  ...props
}: ComponentProps<'button'> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-label={label}
          className={cn(
            'flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground',
            className
          )}
          type='button'
          {...props}
        />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function SidebarSection({
  actions,
  children,
  collapsible = true,
  header = true,
  label,
  storageKey,
  subject,
  title,
}: {
  actions?: ReactNode;
  children: ReactNode;
  collapsible?: boolean;
  header?: boolean;
  label: string;
  storageKey: string;
  subject: string;
  title: string;
}) {
  const list = useId();

  const [collapsed, setCollapsed] = usePersistentState(
    storageKey,
    collapsedSchema,
    false
  );

  return (
    <div className='flex flex-col gap-1'>
      {header && (
        <div className='sticky top-0 z-10 flex items-center gap-1 bg-sidebar px-2'>
          <h2 className='text-xs font-medium text-muted-foreground'>{title}</h2>
          {collapsible && (
            <HeaderButton
              aria-controls={list}
              aria-expanded={!collapsed}
              label={collapsed ? `Show ${subject}` : `Hide ${subject}`}
              onClick={() => setCollapsed(!collapsed)}
            >
              <ChevronDown
                aria-hidden='true'
                className={cn(
                  'size-3.5 transition-transform',
                  collapsed && '-rotate-90'
                )}
              />
            </HeaderButton>
          )}
          {actions}
        </div>
      )}
      <nav aria-label={label} hidden={collapsed} id={list}>
        {children}
      </nav>
    </div>
  );
}

function SortMenu() {
  const [sort, setSort] = useConversationSort();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <HeaderButton className='ml-auto' label='Sort chats'>
          <ArrowDownUp aria-hidden='true' className='size-3.5' />
        </HeaderButton>
      </DropdownMenuTrigger>
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

const PREVIEW = 5;

function openProject(
  projectId: string | undefined,
  chatProject: number | null | undefined
) {
  return projectId === undefined
    ? (chatProject ?? undefined)
    : Number(projectId);
}

function ShowMore({ onClick }: { onClick: () => void }) {
  return (
    <SidebarRow asChild className='text-muted-foreground hover:text-foreground'>
      <button onClick={onClick} type='button'>
        Show more
      </button>
    </SidebarRow>
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
    <ul className='flex flex-col gap-0.5 pl-6'>
      {chats.data && (
        <AnimatePresence initial={false}>
          {all.slice(0, PREVIEW).map((conversation) => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              onSelect={onSelect}
              selected={conversation.id === selected}
            />
          ))}
        </AnimatePresence>
      )}
      {(all.length > PREVIEW || chats.hasNextPage) && (
        <ShowMore onClick={() => onProject(id)} />
      )}
    </ul>
  );
}

export function ProjectsSection({
  onProject,
  onSelect,
  selected,
}: {
  onProject: (id: number) => void;
  onSelect?: () => void;
  selected: number | undefined;
}) {
  const path = usePath();
  const projects = useProjects();
  const summary = useConversationSummary(selected);

  const presence = useRowPresence();

  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState<ProjectEditing>();
  const [closed, setClosed] = useState<number>();

  const { projectId } = useParams({ strict: false });

  const [previous, setPrevious] = useState<number>();

  const open =
    selected !== undefined && summary.isPending
      ? previous
      : openProject(projectId, summary.data?.projectId);

  if (open !== previous) {
    setPrevious(open);
    setClosed(undefined);
  }

  const showing = closed === open ? undefined : open;

  const select = (id: number) => {
    if (path !== `/projects/${id}`) {
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
    <>
      <SidebarSection
        actions={
          <HeaderButton
            className='ml-auto'
            label='New project'
            onClick={() => setEditing({ kind: 'new' })}
          >
            <Plus aria-hidden='true' className='size-3.5' />
          </HeaderButton>
        }
        collapsible={all.length > 0}
        label='Projects'
        storageKey='projects-collapsed'
        subject='projects'
        title='Projects'
      >
        {projects.isError && <LoadError className='px-2' subject='projects' />}
        <ul className='flex flex-col gap-0.5'>
          <AnimatePresence initial={false}>
            {shown.map((project) => {
              const Icon = project.id === showing ? FolderOpen : Folder;
              const page = path === `/projects/${project.id}`;

              return (
                <Fragment key={project.id}>
                  <MotionSidebarRow
                    {...presence}
                    actions={
                      <ProjectMenu
                        className={rowAction}
                        onRename={() => setEditing({ kind: 'rename', project })}
                        project={project}
                      />
                    }
                    asChild
                    selected={page}
                  >
                    <button
                      aria-current={page ? 'page' : undefined}
                      aria-expanded={page ? project.id === showing : undefined}
                      onClick={() => select(project.id)}
                      type='button'
                    >
                      <Icon aria-hidden='true' />
                      <span className='truncate'>{project.name}</span>
                    </button>
                  </MotionSidebarRow>
                  {project.id === showing && (
                    <li>
                      <ProjectChats
                        id={project.id}
                        onProject={onProject}
                        onSelect={onSelect}
                        selected={selected}
                      />
                    </li>
                  )}
                </Fragment>
              );
            })}
          </AnimatePresence>
          {!expanded && all.length > shown.length && (
            <ShowMore onClick={() => setExpanded(true)} />
          )}
        </ul>
      </SidebarSection>
      <ProjectDialog
        editing={editing}
        onClose={() => setEditing(undefined)}
        onCreated={(project) => onProject(project.id)}
      />
    </>
  );
}

export function AppsSection({ onSelect }: { onSelect?: () => void }) {
  const apps = usePins(null);

  if (apps.isError) {
    return <LoadError className='px-2' subject='apps' />;
  }

  if ((apps.data?.length ?? 0) === 0) {
    return null;
  }

  return (
    <SidebarSection
      label='Apps'
      storageKey='apps-collapsed'
      subject='apps'
      title='Apps'
    >
      <ul className='flex flex-col gap-0.5'>
        <AnimatePresence initial={false}>
          {apps.data?.map((app) => (
            <AppLink
              key={`${app.conversationId}/${app.artifactId}`}
              app={app}
              onSelect={onSelect}
            />
          ))}
        </AnimatePresence>
      </ul>
    </SidebarSection>
  );
}

export function PinnedSection({
  onSelect,
  selected,
}: {
  onSelect?: () => void;
  selected: number | undefined;
}) {
  const pinned = usePinnedConversations();

  if (pinned.isError) {
    return <LoadError className='px-2' subject='pinned chats' />;
  }

  if ((pinned.data?.length ?? 0) === 0) {
    return null;
  }

  return (
    <SidebarSection
      actions={<SortMenu />}
      label='Pinned chats'
      storageKey='pinned-collapsed'
      subject='pinned chats'
      title='Pinned'
    >
      <ul className='flex flex-col gap-0.5'>
        <AnimatePresence initial={false}>
          {pinned.data?.map((conversation) => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              onSelect={onSelect}
              selected={conversation.id === selected}
            />
          ))}
        </AnimatePresence>
      </ul>
    </SidebarSection>
  );
}

export function RecentsSection({
  conversations,
  error,
  onLoadMore,
  onSelect,
  selected,
}: {
  conversations: ReturnType<typeof useConversations>['data'];
  error: boolean;
  onLoadMore: (() => void) | undefined;
  onSelect?: () => void;
  selected: number | undefined;
}) {
  return (
    <SidebarSection
      actions={<SortMenu />}
      header={error || (conversations?.length ?? 0) > 0}
      label='Chats'
      storageKey='recents-collapsed'
      subject='chats'
      title='Recents'
    >
      {error && <LoadError className='px-2' subject='chats' />}
      <ul className='flex flex-col gap-0.5'>
        {conversations && (
          <AnimatePresence initial={false}>
            {conversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                onSelect={onSelect}
                selected={conversation.id === selected}
              />
            ))}
          </AnimatePresence>
        )}
      </ul>
      {onLoadMore && <LoadMore onLoadMore={onLoadMore} />}
    </SidebarSection>
  );
}
