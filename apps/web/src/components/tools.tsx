import { type SettingsSection, selectSettingsSection } from '@/lib/settings';
import { cn } from '@/lib/utils';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  Check,
  Code,
  FileText,
  Lightbulb,
  LoaderCircle,
  MessageSquareText,
  MessagesSquare,
  type LucideIcon,
  Search,
  WandSparkles,
  Wrench,
  X,
} from 'lucide-react';
import { type ReactNode, createContext, useState } from 'react';

export type ToolResult = {
  details?: unknown;
  isError: boolean;
  output: string;
};

export type ToolProgress = {
  details?: unknown;
  output?: string;
  status: 'pending' | 'running' | 'done';
};

export type ToolRecord = {
  args: Record<string, unknown>;
  details: unknown;
  name: string;
};

export const ToolHistory = createContext<readonly ToolRecord[]>([]);

export type ToolView = {
  active: boolean;
  args: Record<string, unknown>;
  details: unknown;
  history: readonly ToolRecord[];
  output: string;
};

type ToolRenderer = {
  actions?: ReactNode;
  preview?: (view: ToolView) => ReactNode;
  icon: LucideIcon;
  summary?: (view: ToolView) => string | undefined;
  title: (view: ToolView) => string;
};

type NestedCall = {
  args: string;
  id: number;
  name: string;
  status: 'cancelled' | 'error' | 'ok' | 'running';
};

type LibraryEntry = {
  chat: string | null;
  createdAt: string;
  id: number;
  name: string;
  size: number;
};

const PREVIEW_ITEMS = 5;

const day = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
});

const bytes = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
  notation: 'compact',
  style: 'unit',
  unit: 'byte',
  unitDisplay: 'narrow',
});

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function field(value: unknown, key: string) {
  return typeof value === 'object' && value !== null && key in value
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

function count(value: unknown) {
  return typeof value === 'number' ? value : undefined;
}

function plural(amount: number, noun: string) {
  return `${amount} ${noun}${amount === 1 ? '' : 's'}`;
}

function quoted(value: unknown) {
  const content = text(value);

  return content ? ` for “${content}”` : '';
}

function parse(args: string) {
  try {
    const value: unknown = JSON.parse(args);

    return typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function Label({ children }: { children: string }) {
  return <span className='text-xs text-muted-foreground'>{children}</span>;
}

type PreviewItem = {
  chatId?: number;
  key: string;
  label: string;
  meta?: string;
};

function PreviewRow({ chatId, label, meta }: PreviewItem) {
  const content = (
    <>
      <span className='min-w-0 truncate text-foreground/90 underline-offset-4 group-hover:underline'>
        {label}
      </span>
      {meta && (
        <span className='shrink-0 text-xs text-muted-foreground tabular-nums'>
          {meta}
        </span>
      )}
    </>
  );

  if (chatId === undefined) {
    return content;
  }

  return (
    <Link
      className='group flex min-w-0 flex-1 items-baseline justify-between gap-4 outline-none focus-visible:underline'
      params={{ id: chatId }}
      to='/c/$id'
    >
      {content}
    </Link>
  );
}

function PreviewList({ items }: { items: readonly PreviewItem[] }) {
  const shown = items.slice(0, PREVIEW_ITEMS);

  const rest = items.length - shown.length;

  return (
    <ul className='flex flex-col'>
      {shown.map((item) => (
        <li
          key={item.key}
          className='flex items-baseline justify-between gap-4 py-1 text-sm'
        >
          <PreviewRow {...item} />
        </li>
      ))}
      {rest > 0 && (
        <li className='py-1 text-xs text-muted-foreground'>{rest} more</li>
      )}
    </ul>
  );
}

function PreviewPassage({ children }: { children: string }) {
  return (
    <p className='line-clamp-6 text-sm/relaxed whitespace-pre-wrap text-foreground/80'>
      {children}
    </p>
  );
}

function MemoryNote({
  forgotten = false,
  text: note,
}: {
  forgotten?: boolean;
  text: string;
}) {
  return (
    <p
      className={cn(
        'rounded-xl bg-muted/40 px-3.5 py-3 text-sm/relaxed text-foreground/90',
        forgotten && 'text-muted-foreground line-through'
      )}
    >
      {note}
    </p>
  );
}

function FooterButton({
  children,
  onClick,
}: {
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      className='text-xs text-muted-foreground transition-colors hover:text-foreground'
      onClick={onClick}
      type='button'
    >
      {children}
    </button>
  );
}

function SettingsLink({
  children,
  section,
}: {
  children: string;
  section: SettingsSection;
}) {
  const navigate = useNavigate();

  return (
    <FooterButton
      onClick={() => {
        selectSettingsSection(section);
        void navigate({ to: '/settings' });
      }}
    >
      {children}
    </FooterButton>
  );
}

const manageMemories = (
  <SettingsLink section='memory'>Manage memories</SettingsLink>
);

const manageSkills = (
  <SettingsLink section='skills'>Manage skills</SettingsLink>
);

function SkillCard({
  deleted = false,
  details,
}: {
  deleted?: boolean;
  details: unknown;
}) {
  const name = text(field(details, 'name'));

  const description = text(field(details, 'description'));

  if (!name) {
    return undefined;
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-0.5 rounded-xl bg-muted/40 px-3.5 py-3 text-sm',
        deleted && 'text-muted-foreground line-through'
      )}
    >
      <span className='font-medium'>{name}</span>
      {description && (
        <span className='text-muted-foreground'>{description}</span>
      )}
    </div>
  );
}

function forgottenText({ args, details, history }: ToolView) {
  const saved = text(field(details, 'text'));

  if (saved) {
    return saved;
  }

  const id = text(args.id);

  const remembered = history.find(
    (record) =>
      record.name === 'remember' && text(field(record.details, 'id')) === id
  );

  return (
    remembered &&
    (text(field(remembered.details, 'text')) ?? text(remembered.args.text))
  );
}

function skillTitle(running: string, done: string) {
  return ({ active, details }: ToolView) => {
    const name = text(field(details, 'name'));

    if (active) {
      return running;
    }

    return name ? `${done} the “${name}” skill` : `${done} a skill`;
  };
}

function Block({ children, label }: { children: string; label: string }) {
  return (
    <div className='flex flex-col gap-1.5'>
      <Label>{label}</Label>
      <pre className='max-h-64 overflow-auto rounded-xl bg-muted/40 px-3.5 py-3 font-mono text-xs/relaxed whitespace-pre-wrap text-foreground/80'>
        {children}
      </pre>
    </div>
  );
}

function Raw({ args, output }: ToolView) {
  const shown = Object.keys(args).length > 0;

  return (
    <>
      {shown && (
        <Block label='Arguments'>{JSON.stringify(args, null, 2)}</Block>
      )}
      <Block label='Output'>{output || 'No output'}</Block>
    </>
  );
}

const statusIcons = {
  cancelled: X,
  error: X,
  ok: Check,
  running: LoaderCircle,
};

function Script({ args, details, output }: ToolView) {
  const calls = (field(details, 'calls') as NestedCall[] | undefined) ?? [];

  return (
    <>
      {calls.length > 0 && (
        <ul className='flex flex-col gap-1 text-sm text-muted-foreground'>
          {calls.map((call) => {
            const Icon = statusIcons[call.status];

            const view = {
              active: call.status === 'running',
              args: parse(call.args),
              details: undefined,
              history: [],
              output: '',
            };

            return (
              <li key={call.id} className='flex items-center gap-2'>
                <Icon
                  aria-hidden='true'
                  className='size-3.5 shrink-0 motion-safe:data-[running=true]:animate-spin'
                  data-running={call.status === 'running'}
                />
                {toolRenderer(call.name).title(view)}
              </li>
            );
          })}
        </ul>
      )}
      {text(args.code) && <Block label='Script'>{String(args.code)}</Block>}
      <Block label='Result'>{output || 'No output'}</Block>
    </>
  );
}

function readRange(details: unknown) {
  const start = count(field(details, 'start'));
  const end = count(field(details, 'end'));
  const total = count(field(details, 'total'));

  if (start === undefined || end === undefined || total === undefined) {
    return undefined;
  }

  if (start === 0 && end === total) {
    return plural(total, 'character');
  }

  return `characters ${start}–${end} of ${total}`;
}

type ChatMatch = { id: number; title: string | null; updatedAt: string };

const renderers: Partial<Record<string, ToolRenderer>> = {
  chat_read: {
    icon: MessageSquareText,
    preview: ({ details }) => {
      const passage = text(field(details, 'passage'));

      return passage ? <PreviewPassage>{passage}</PreviewPassage> : undefined;
    },
    summary: ({ details }) => readRange(details),
    title: ({ active, details }) => {
      const title = text(field(details, 'title'));

      if (active) {
        return 'Reading a chat';
      }

      return title ? `Read “${title}”` : 'Read a chat';
    },
  },
  chat_search: {
    icon: MessagesSquare,
    preview: ({ details }) => {
      const matches = field(details, 'matches') as ChatMatch[] | undefined;

      if (!matches?.length) {
        return undefined;
      }

      return (
        <PreviewList
          items={matches.map(({ id, title, updatedAt }) => ({
            chatId: id,
            key: String(id),
            label: title ?? 'Untitled chat',
            meta: day.format(new Date(updatedAt)),
          }))}
        />
      );
    },
    summary: ({ details }) => {
      const found = count(field(details, 'count'));

      return found === undefined ? undefined : plural(found, 'chat');
    },
    title: ({ active, args }) =>
      `${active ? 'Searching' : 'Searched'} your chats${quoted(args.query)}`,
  },
  codemode: {
    preview: Script,
    icon: Code,
    summary: ({ details }) => {
      const calls = field(details, 'calls');

      if (!Array.isArray(calls) || calls.length === 0) {
        return undefined;
      }

      return plural(calls.length, 'tool call');
    },
    title: ({ active }) => (active ? 'Running a script' : 'Ran a script'),
  },
  forget: {
    actions: manageMemories,
    icon: Lightbulb,
    preview: (view) => {
      const note = forgottenText(view);

      if (!note) {
        return (
          <p className='text-sm text-muted-foreground'>
            The forgotten memory's text isn't available.
          </p>
        );
      }

      return <MemoryNote forgotten text={note} />;
    },
    title: (view) => {
      const note = forgottenText(view);

      if (view.active) {
        return 'Forgetting a memory';
      }

      return note ? `Forgot “${note}”` : 'Forgot a memory';
    },
  },
  library_read: {
    preview: ({ details }) => {
      const passage = text(field(details, 'passage'));

      return passage ? <PreviewPassage>{passage}</PreviewPassage> : undefined;
    },
    icon: FileText,
    summary: ({ details }) => readRange(details),
    title: ({ active, details }) => {
      const name = text(field(details, 'name'));

      if (active) {
        return 'Reading a file';
      }

      return name ? `Read ${name}` : 'Read a file';
    },
  },
  library_search: {
    preview: ({ details }) => {
      const entries = field(details, 'entries') as LibraryEntry[] | undefined;

      if (!entries?.length) {
        return undefined;
      }

      return (
        <PreviewList
          items={entries.map(({ createdAt, id, name, size }) => ({
            key: String(id),
            label: name,
            meta: `${bytes.format(size)} · ${day.format(new Date(createdAt))}`,
          }))}
        />
      );
    },
    icon: Search,
    summary: ({ details }) => {
      const found = count(field(details, 'count'));

      return found === undefined ? undefined : plural(found, 'file');
    },
    title: ({ active, args }) =>
      `${active ? 'Searching' : 'Searched'} your library${quoted(args.query)}`,
  },
  remember: {
    actions: manageMemories,
    icon: Lightbulb,
    preview: ({ args, details }) => {
      const note = text(field(details, 'text')) ?? text(args.text);

      return note && details ? <MemoryNote text={note} /> : undefined;
    },
    title: ({ active, args }) => {
      const memory = text(args.text);

      const verb = active ? 'Remembering' : 'Remembered';

      return memory ? `${verb} “${memory}”` : verb;
    },
  },
  skill_create: {
    actions: manageSkills,
    icon: WandSparkles,
    preview: ({ details }) => <SkillCard details={details} />,
    title: skillTitle('Creating a skill', 'Created'),
  },
  skill_delete: {
    actions: manageSkills,
    icon: WandSparkles,
    preview: ({ details }) => <SkillCard deleted details={details} />,
    title: skillTitle('Deleting a skill', 'Deleted'),
  },
  skill_read: {
    actions: manageSkills,
    icon: WandSparkles,
    preview: ({ details }) => {
      const instructions = text(field(details, 'instructions'));

      return instructions ? (
        <PreviewPassage>{instructions}</PreviewPassage>
      ) : undefined;
    },
    title: skillTitle('Reading a skill', 'Read'),
  },
  skill_update: {
    actions: manageSkills,
    icon: WandSparkles,
    preview: ({ details }) => <SkillCard details={details} />,
    title: skillTitle('Updating a skill', 'Updated'),
  },
};

const fallback = (name: string): ToolRenderer => ({
  icon: Wrench,
  title: ({ active }) => `${active ? 'Running' : 'Ran'} ${name}`,
});

export function toolRenderer(name: string): ToolRenderer {
  return renderers[name] ?? fallback(name);
}

export function ToolBody(props: ToolView & { name: string }) {
  const [raw, setRaw] = useState(false);

  const renderer = toolRenderer(props.name);

  const preview = renderer.preview?.(props);

  if (preview === undefined || preview === null) {
    return <Raw {...props} />;
  }

  return (
    <>
      {preview}
      <div className='flex items-center gap-4'>
        {renderer.actions}
        <FooterButton onClick={() => setRaw(!raw)}>
          {raw ? 'Hide raw output' : 'Show raw output'}
        </FooterButton>
      </div>
      {raw && <Raw {...props} />}
    </>
  );
}
