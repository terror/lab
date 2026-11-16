import {
  Check,
  Code,
  FileText,
  Lightbulb,
  LoaderCircle,
  type LucideIcon,
  Search,
  Wrench,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';

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

export type ToolView = {
  active: boolean;
  args: Record<string, unknown>;
  details: unknown;
  output: string;
};

type ToolRenderer = {
  Body?: (view: ToolView) => ReactNode;
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

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function field(value: unknown, key: string) {
  return typeof value === 'object' && value !== null && key in value
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
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

function Block({ children, label }: { children: string; label: string }) {
  return (
    <div className='flex flex-col gap-1.5'>
      <span className='text-xs text-muted-foreground'>{label}</span>
      <pre className='max-h-64 overflow-auto rounded-xl bg-muted/40 px-3.5 py-3 font-mono text-xs/relaxed whitespace-pre-wrap text-foreground/80'>
        {children}
      </pre>
    </div>
  );
}

function DefaultBody({ args, output }: ToolView) {
  const shown = Object.keys(args).length > 0;

  return (
    <>
      {shown && (
        <Block label='Arguments'>{JSON.stringify(args, null, 2)}</Block>
      )}
      <Block label='Result'>{output || 'No output'}</Block>
    </>
  );
}

const statusIcons = {
  cancelled: X,
  error: X,
  ok: Check,
  running: LoaderCircle,
};

function ScriptBody({ args, details, output }: ToolView) {
  const calls = (field(details, 'calls') as NestedCall[] | undefined) ?? [];

  return (
    <>
      {calls.length > 0 && (
        <div className='flex flex-col gap-1.5'>
          <span className='text-xs text-muted-foreground'>Calls</span>
          <ul className='flex flex-col gap-1 text-sm text-muted-foreground'>
            {calls.map((call) => {
              const Icon = statusIcons[call.status];

              const view = {
                active: call.status === 'running',
                args: parse(call.args),
                details: undefined,
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
        </div>
      )}
      {text(args.code) && <Block label='Script'>{String(args.code)}</Block>}
      <Block label='Result'>{output || 'No output'}</Block>
    </>
  );
}

const renderers: Partial<Record<string, ToolRenderer>> = {
  codemode: {
    Body: ScriptBody,
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
    icon: Lightbulb,
    title: ({ active }) => (active ? 'Forgetting a memory' : 'Forgot a memory'),
  },
  library_read: {
    icon: FileText,
    summary: ({ output }) => {
      const range = /\[Showing characters (\d+)–(\d+) of (\d+)\./.exec(output);

      if (range) {
        return `characters ${range[1]}–${range[2]} of ${range[3]}`;
      }

      const end = /\[End of file at character (\d+)\.\]$/.exec(output);

      return end ? plural(Number(end[1]), 'character') : undefined;
    },
    title: ({ active, output }) => {
      const name = text(output.split('\n')[0]);

      if (active || !name) {
        return active ? 'Reading a file' : 'Read a file';
      }

      return `Read ${name}`;
    },
  },
  library_search: {
    icon: Search,
    summary: ({ details }) => {
      const count = field(details, 'count');

      return typeof count === 'number' ? plural(count, 'file') : undefined;
    },
    title: ({ active, args }) =>
      `${active ? 'Searching' : 'Searched'} your library${quoted(args.query)}`,
  },
  remember: {
    icon: Lightbulb,
    title: ({ active, args }) => {
      const memory = text(args.text);

      const verb = active ? 'Remembering' : 'Remembered';

      return memory ? `${verb} “${memory}”` : verb;
    },
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
  const { Body = DefaultBody } = toolRenderer(props.name);

  return <Body {...props} />;
}
