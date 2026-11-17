import {
  type ProjectEditing,
  ProjectDialog,
} from '@/components/project-dialog';
import {
  Command,
  CommandDialog,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Kbd } from '@/components/ui/kbd';
import {
  conversationTitle,
  useConversations,
  useStartChat,
} from '@/lib/conversations';
import { useChatModel } from '@/lib/models';
import { useProjects } from '@/lib/projects';
import { type Segment, useWorkspaceSearch } from '@/lib/search';
import {
  type SettingsSection,
  selectSettingsSection,
  settingsSectionInfo,
  useSettingsSections,
} from '@/lib/settings';
import { useTheme } from '@/lib/theme';
import { ago, untilRun } from '@/lib/time';
import { cn } from '@/lib/utils';
import { useNavigate } from '@tanstack/react-router';
import {
  Clock,
  File,
  Folder,
  FolderPlus,
  type LucideIcon,
  MessageSquare,
  MessageSquarePlus,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
} from 'lucide-react';
import {
  type KeyboardEvent,
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';

const SearchContext = createContext<{ openSearch: () => void }>({
  openSearch: () => undefined,
});

export function useSearch() {
  return useContext(SearchContext);
}

type Scope = 'chats' | 'files' | 'projects' | 'scheduled' | 'settings';

const scopes: { id: Scope; label: string }[] = [
  { id: 'chats', label: 'Chats' },
  { id: 'projects', label: 'Projects' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'files', label: 'Files' },
  { id: 'settings', label: 'Settings' },
];

const PREVIEW = 3;

type Row = {
  chip?: string;
  icon: LucideIcon;
  key: string;
  keys?: string[];
  meta?: string;
  onSelect: () => void;
  snippet?: Segment[] | null;
  title: string;
};

function Highlighted({ segments }: { segments: readonly Segment[] }) {
  return segments.map(({ match, text }, index) =>
    match ? (
      <span key={index} className='font-semibold text-foreground'>
        {text}
      </span>
    ) : (
      text
    )
  );
}

function Keys({ keys }: { keys: readonly string[] }) {
  return (
    <span className='flex gap-0.5'>
      {keys.map((key) => (
        <Kbd key={key}>{key}</Kbd>
      ))}
    </span>
  );
}

function ResultRow({ row }: { row: Row }) {
  const Icon = row.icon;

  return (
    <CommandItem
      className='group items-start gap-2.5 rounded-lg px-2.5 py-2'
      onSelect={row.onSelect}
      value={row.key}
    >
      <Icon aria-hidden='true' className='mt-0.5 text-muted-foreground' />
      <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
        <span className='flex min-w-0 items-center gap-2'>
          <span className='truncate'>{row.title}</span>
          {row.chip && (
            <span className='shrink-0 rounded-full border px-2 text-xs text-muted-foreground'>
              {row.chip}
            </span>
          )}
          <span
            className='ml-auto flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground tabular-nums'
            data-slot='command-shortcut'
          >
            <span className='group-data-selected:hidden'>
              {row.keys ? <Keys keys={row.keys} /> : row.meta}
            </span>
            <span className='hidden items-center gap-1.5 group-data-selected:flex'>
              Open <Kbd>↵</Kbd>
            </span>
          </span>
        </span>
        {row.snippet && (
          <span className='truncate text-xs text-muted-foreground'>
            <Highlighted segments={row.snippet} />
          </span>
        )}
      </span>
    </CommandItem>
  );
}

function Group({ heading, rows }: { heading: string; rows: readonly Row[] }) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <CommandGroup heading={heading}>
      {rows.map((row) => (
        <ResultRow key={row.key} row={row} />
      ))}
    </CommandGroup>
  );
}

function useGo(onDone: () => void) {
  const navigate = useNavigate();

  return useMemo(
    () => ({
      chat: (id: number) => {
        onDone();
        void navigate({ params: { id }, to: '/c/$id' });
      },
      project: (id: number) => {
        onDone();
        void navigate({
          params: { projectId: String(id) },
          to: '/projects/$projectId',
        });
      },
      route: (to: '/' | '/library' | '/scheduled' | '/settings') => {
        onDone();
        void navigate({ to });
      },
      settings: (section: SettingsSection) => {
        selectSettingsSection(section);
        onDone();
        void navigate({ to: '/settings' });
      },
    }),
    [navigate, onDone]
  );
}

function useProjectNames() {
  const projects = useProjects();

  return useMemo(
    () =>
      new Map(
        (projects.data?.projects ?? []).map(({ id, name }) => [id, name])
      ),
    [projects.data]
  );
}

function useResultGroups(query: string, onDone: () => void) {
  const results = useWorkspaceSearch(query);
  const projectNames = useProjectNames();
  const go = useGo(onDone);
  const sections = useSettingsSections();

  const data = query ? results.data : undefined;

  const lower = query.toLowerCase();

  return useMemo<Record<Scope, Row[]>>(
    () => ({
      chats: (data?.chats ?? []).map((chat) => ({
        chip:
          chat.projectId === null
            ? undefined
            : projectNames.get(chat.projectId),
        icon: MessageSquare,
        key: `chat-${chat.id}`,
        meta: ago(chat.updatedAt),
        onSelect: () => go.chat(chat.id),
        snippet: chat.snippet,
        title: conversationTitle(chat.title),
      })),
      files: (data?.files ?? []).map((file) => ({
        icon: File,
        key: `file-${file.id}`,
        meta: ago(file.createdAt),
        onSelect: () => go.route('/library'),
        title: file.name,
      })),
      projects: (data?.projects ?? []).map((project) => ({
        icon: Folder,
        key: `project-${project.id}`,
        meta: `${project.chats} ${project.chats === 1 ? 'chat' : 'chats'}`,
        onSelect: () => go.project(project.id),
        title: project.name,
      })),
      scheduled: (data?.schedules ?? []).map((task) => ({
        icon: Clock,
        key: `scheduled-${task.id}`,
        meta:
          task.enabled && task.nextRunAt
            ? untilRun(task.nextRunAt)
            : task.description,
        onSelect: () =>
          task.conversationId === null
            ? go.route('/scheduled')
            : go.chat(task.conversationId),
        title: task.title,
      })),
      settings: query
        ? sections
            .filter((id) =>
              settingsSectionInfo[id].label.toLowerCase().includes(lower)
            )
            .map((id) => ({
              icon: settingsSectionInfo[id].icon,
              key: `settings-${id}`,
              meta: 'Settings',
              onSelect: () => go.settings(id),
              title: settingsSectionInfo[id].label,
            }))
        : [],
    }),
    [data, go, lower, projectNames, query, sections]
  );
}

function EmptyQuery({
  onDone,
  onNewProject,
}: {
  onDone: () => void;
  onNewProject: () => void;
}) {
  const recents = useConversations();
  const projectNames = useProjectNames();
  const go = useGo(onDone);
  const [theme, setTheme] = useTheme();

  const dark =
    theme === 'dark' ||
    (theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  const recent: Row[] = (recents.data ?? []).slice(0, 4).map((chat) => ({
    chip:
      chat.projectId === null ? undefined : projectNames.get(chat.projectId),
    icon: MessageSquare,
    key: `recent-${chat.id}`,
    onSelect: () => go.chat(chat.id),
    title: conversationTitle(chat.title),
  }));

  const actions: Row[] = [
    {
      icon: Plus,
      key: 'new-chat',
      keys: ['⌘', '⇧', 'O'],
      onSelect: () => go.route('/'),
      title: 'New chat',
    },
    {
      icon: FolderPlus,
      key: 'new-project',
      onSelect: onNewProject,
      title: 'New project',
    },
    {
      icon: dark ? Sun : Moon,
      key: 'theme',
      onSelect: () => {
        setTheme(dark ? 'light' : 'dark');
        onDone();
      },
      title: dark ? 'Switch to light theme' : 'Switch to dark theme',
    },
    {
      icon: Settings,
      key: 'settings',
      keys: ['⌘', ','],
      onSelect: () => go.route('/settings'),
      title: 'Settings',
    },
  ];

  return (
    <>
      <Group heading='Recent' rows={recent} />
      <Group heading='Actions' rows={actions} />
    </>
  );
}

function ScopePills({
  counts,
  onScope,
  scope,
}: {
  counts: Record<Scope, number>;
  onScope: (scope: Scope | 'all') => void;
  scope: Scope | 'all';
}) {
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

  const pills = [
    { count: total, id: 'all' as const, label: 'All' },
    ...scopes
      .filter(({ id }) => counts[id] > 0)
      .map(({ id, label }) => ({ count: counts[id], id, label })),
  ];

  return (
    <fieldset className='flex items-center gap-1 overflow-x-auto px-2.5 py-1.5'>
      <legend className='sr-only'>Scope</legend>
      {pills.map(({ count, id, label }) => (
        <button
          key={id}
          aria-pressed={scope === id}
          className={cn(
            'flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs text-muted-foreground outline-none hover:text-foreground',
            scope === id && 'bg-muted font-medium text-foreground'
          )}
          onClick={() => onScope(id)}
          type='button'
        >
          {label}
          <span className='font-normal text-muted-foreground tabular-nums'>
            {count}
          </span>
        </button>
      ))}
    </fieldset>
  );
}

function Footer() {
  const hints: [string[], string][] = [
    [['↑', '↓'], 'navigate'],
    [['↵'], 'open'],
    [['⇥'], 'scope'],
    [['⌘', '↵'], 'ask Lab'],
    [['esc'], 'close'],
  ];

  return (
    <div className='flex h-9 items-center gap-4 border-t px-4 text-xs text-muted-foreground'>
      {hints.map(([keys, label]) => (
        <span key={label} className='flex items-center gap-1.5'>
          <Keys keys={keys} />
          {label}
        </span>
      ))}
    </div>
  );
}

function Palette({
  onDone,
  onNewProject,
}: {
  onDone: () => void;
  onNewProject: () => void;
}) {
  const [model] = useChatModel();

  const start = useStartChat({ inlineError: false });

  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<Scope | 'all'>('all');
  const [selected, setSelected] = useState('');

  const query = useDeferredValue(search.trim());

  const groups = useResultGroups(query, onDone);

  const counts: Record<Scope, number> = {
    chats: groups.chats.length,
    files: groups.files.length,
    projects: groups.projects.length,
    scheduled: groups.scheduled.length,
    settings: groups.settings.length,
  };

  const shown = scopes.filter(
    ({ id }) => counts[id] > 0 && (scope === 'all' || scope === id)
  );

  const sections = shown.map(({ id, label }) => {
    const rows =
      scope === 'all' && groups[id].length > PREVIEW + 1
        ? groups[id].slice(0, PREVIEW)
        : groups[id];

    return { hidden: groups[id].length - rows.length, id, label, rows };
  });

  const keys = [
    ...sections.flatMap(({ hidden, id, rows }) => [
      ...rows.map(({ key }) => key),
      ...(hidden > 0 ? [`more-${id}`] : []),
    ]),
    'ask',
  ];

  const current = keys.includes(selected) ? selected : (keys[0] ?? '');

  const visible: (Scope | 'all')[] = [
    'all',
    ...scopes.filter(({ id }) => counts[id] > 0).map(({ id }) => id),
  ];

  const ask = () => {
    if (!query) {
      return;
    }

    onDone();
    start.mutate({ attachments: [], content: query, model });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && event.metaKey) {
      event.preventDefault();
      ask();
    }

    if (event.key === 'Tab' && query) {
      event.preventDefault();

      const index = visible.indexOf(scope);
      const step = event.shiftKey ? -1 : 1;

      setScope(
        visible[(index + step + visible.length) % visible.length] ?? 'all'
      );
    }
  };

  return (
    <Command
      onKeyDown={onKeyDown}
      onValueChange={setSelected}
      shouldFilter={false}
      value={query ? current : undefined}
    >
      <label className='flex h-12 items-center gap-3 px-4'>
        <Search aria-hidden='true' className='size-4 text-muted-foreground' />
        <input
          aria-label='Search Lab'
          className='flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground'
          onChange={(event) => {
            setSearch(event.target.value);
            setScope('all');
          }}
          placeholder='Search Lab'
          value={search}
        />
      </label>
      <div className='h-px bg-border' />
      {query && <ScopePills counts={counts} onScope={setScope} scope={scope} />}
      <CommandList className='max-h-96 px-1.5 pb-1.5'>
        {!query && <EmptyQuery onDone={onDone} onNewProject={onNewProject} />}
        {sections.map(({ hidden, id, label, rows }) => (
          <CommandGroup key={id} heading={label}>
            {rows.map((row) => (
              <ResultRow key={row.key} row={row} />
            ))}
            {hidden > 0 && (
              <CommandItem
                className='rounded-lg px-2.5 pl-9 text-xs text-muted-foreground'
                onSelect={() => setScope(id)}
                value={`more-${id}`}
              >
                {`${hidden} more ${label.toLowerCase()}`}
                <Kbd className='ml-auto' data-slot='command-shortcut'>
                  ⇥
                </Kbd>
              </CommandItem>
            )}
          </CommandGroup>
        ))}
        {query && (
          <CommandGroup>
            <CommandItem
              className='gap-2.5 rounded-lg px-2.5 py-2'
              onSelect={ask}
              value='ask'
            >
              <MessageSquarePlus
                aria-hidden='true'
                className='text-muted-foreground'
              />
              <span className='truncate'>
                Ask Lab about <span className='font-semibold'>“{query}”</span>
              </span>
              <span className='ml-auto' data-slot='command-shortcut'>
                <Keys keys={['⌘', '↵']} />
              </span>
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
      <Footer />
    </Command>
  );
}

export function SearchProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectEditing>();

  const openSearch = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const shortcuts: Record<string, () => void> = {
      Comma: () => {
        setOpen(false);
        void navigate({ to: '/settings' });
      },
      KeyK: () => setOpen((current) => !current),
      'shift+KeyO': () => {
        setOpen(false);
        void navigate({ to: '/' });
      },
    };

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const run =
        (event.metaKey || event.ctrlKey) &&
        shortcuts[`${event.shiftKey ? 'shift+' : ''}${event.code}`];

      if (run) {
        event.preventDefault();
        run();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate]);

  const value = useMemo(() => ({ openSearch }), [openSearch]);

  return (
    <SearchContext.Provider value={value}>
      {children}
      <CommandDialog
        className='rounded-2xl! sm:max-w-xl'
        description='Search chats, projects, scheduled tasks, files, and settings'
        onOpenChange={setOpen}
        open={open}
        title='Search'
      >
        <Palette
          onDone={close}
          onNewProject={() => {
            close();
            setEditing({ kind: 'new' });
          }}
        />
      </CommandDialog>
      <ProjectDialog
        editing={editing}
        onClose={() => setEditing(undefined)}
        onCreated={(project) =>
          void navigate({
            params: { projectId: String(project.id) },
            to: '/projects/$projectId',
          })
        }
      />
    </SearchContext.Provider>
  );
}
