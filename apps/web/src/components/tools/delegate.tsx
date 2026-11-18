import { Markdown } from '@/components/markdown';
import { Card } from '@/components/ui/card';
import { StatusIcon } from '@/components/ui/status-icon';
import {
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from '@/components/ui/trace';
import { plural } from '@/lib/format';
import { Split } from 'lucide-react';

import { field } from './format';
import { type ToolRenderer, type ToolView } from './types';

type Subagent = {
  status: 'done' | 'failed' | 'running';
  summary?: string;
  title: string;
};

const states = {
  done: { label: 'Done', line: undefined },
  failed: { label: 'Failed', line: 'error' },
  running: { label: 'Running', line: undefined },
  stopped: { label: 'Stopped', line: 'pending' },
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

function finished(list: readonly Subagent[]) {
  return list.filter(({ status }) => status === 'done').length;
}

function Row({
  active,
  subagent: { status, summary, title },
}: {
  active: boolean;
  subagent: Subagent;
}) {
  const state = !active && status === 'running' ? 'stopped' : status;

  const { label, line } = states[state];

  const heading = (
    <TraceLine className='h-6.5' status={line}>
      <TraceIcon>
        <StatusIcon status={state} />
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
    <Card className='gap-2 py-3.5' variant='inset'>
      <div className='flex items-center justify-between gap-3 text-sm'>
        <span className='flex items-center gap-2 font-medium'>
          <Split aria-hidden='true' className='size-4 text-muted-foreground' />
          {plural(list.length, 'subagent')}
        </span>
        <span className='text-xs text-muted-foreground tabular-nums'>
          {finished(list)} of {list.length} done
        </span>
      </div>
      <ul className='flex flex-col'>
        {list.map((subagent, index) => (
          <li key={index} className='flex min-w-0 flex-col'>
            <Row active={view.active} subagent={subagent} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

export const delegateRenderers = {
  delegate: {
    icon: Split,
    inline: Subagents,
    summary: (view) => {
      const list = subagents(view);

      return list.length > 0
        ? `${finished(list)} of ${list.length} done`
        : undefined;
    },
    title: (view) => {
      const count = subagents(view).length;

      const tasks = count > 0 ? plural(count, 'task') : 'tasks';

      return `${view.active ? 'Delegating' : 'Delegated'} ${tasks}`;
    },
  },
} satisfies Record<string, ToolRenderer>;
