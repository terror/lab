import { Markdown } from '@/components/markdown';
import {
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from '@/components/ui/trace';
import { plural } from '@/lib/format';
import { Ban, Check, LoaderCircle, Split, X } from 'lucide-react';

import { field } from './format';
import { type ToolRenderer, type ToolView } from './types';

type Subagent = {
  status: 'done' | 'failed' | 'running';
  summary?: string;
  title: string;
};

const states = {
  done: { icon: Check, label: 'Done', line: undefined },
  failed: { icon: X, label: 'Failed', line: 'error' },
  running: { icon: LoaderCircle, label: 'Running', line: 'running' },
  stopped: { icon: Ban, label: 'Stopped', line: 'pending' },
} as const;

function subagents({ args, details }: ToolView): Subagent[] {
  const reported = field(details, 'subagents') as Subagent[] | undefined;

  const tasks = Array.isArray(args.tasks)
    ? (args.tasks as { title?: string }[])
    : [];

  return (
    reported ??
    tasks.map(({ title }) => ({ status: 'running', title: title ?? '' }))
  );
}

function Row({
  active,
  subagent: { status, summary, title },
}: {
  active: boolean;
  subagent: Subagent;
}) {
  const state = !active && status === 'running' ? 'stopped' : status;

  const { icon: Icon, label, line } = states[state];

  const heading = (
    <TraceLine className='h-6.5' status={line}>
      <TraceIcon>
        <Icon
          aria-hidden='true'
          className='size-3.5 motion-safe:data-[running=true]:animate-spin'
          data-running={state === 'running'}
        />
      </TraceIcon>
      <TraceTitle>{title}</TraceTitle>
      <span className='sr-only'>{label}</span>
    </TraceLine>
  );

  if (!summary) {
    return heading;
  }

  return (
    <TraceCollapsible>
      <TraceCollapsibleTrigger>{heading}</TraceCollapsibleTrigger>
      <TraceCollapsibleContent className='text-foreground/80'>
        <Markdown streaming={false}>{summary}</Markdown>
      </TraceCollapsibleContent>
    </TraceCollapsible>
  );
}

function Subagents(view: ToolView) {
  const list = subagents(view);

  if (list.length === 0) {
    return undefined;
  }

  return (
    <ul className='flex flex-col gap-1 rounded-2xl border px-4 py-3'>
      {list.map((subagent, index) => (
        <li key={index} className='flex min-w-0 flex-col'>
          <Row active={view.active} subagent={subagent} />
        </li>
      ))}
    </ul>
  );
}

export const delegateRenderers = {
  delegate: {
    icon: Split,
    inline: Subagents,
    summary: (view) => {
      const list = subagents(view);

      const done = list.filter(({ status }) => status === 'done').length;

      return list.length > 0 ? `${done} of ${list.length} done` : undefined;
    },
    title: (view) => {
      const count = subagents(view).length;

      const tasks = count > 0 ? plural(count, 'task') : 'tasks';

      return `${view.active ? 'Delegating' : 'Delegated'} ${tasks}`;
    },
  },
} satisfies Record<string, ToolRenderer>;
