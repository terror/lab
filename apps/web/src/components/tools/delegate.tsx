import { Markdown } from '@/components/markdown';
import { Card } from '@/components/ui/card';
import { CollapsibleTrigger } from '@/components/ui/collapsible';
import { ProgressCount } from '@/components/ui/progress-count';
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
import { fade, spring, stagger } from '@/lib/motion';
import { ChevronRight, Split } from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import { useEffect, useState } from 'react';

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

const FOLD_DELAY_MS = 700;

function Row({
  active,
  index,
  subagent: { status, summary, title },
}: {
  active: boolean;
  index: number;
  subagent: Subagent;
}) {
  const state = !active && status === 'running' ? 'stopped' : status;

  const { label, line } = states[state];

  const heading = (
    <TraceLine className='h-6.5' status={line}>
      <TraceIcon className='relative'>
        <AnimatePresence initial={false}>
          <m.span
            key={state}
            animate={{ opacity: 1, scale: 1 }}
            className='absolute inset-0 flex items-center justify-center'
            exit={{ opacity: 0, scale: 0 }}
            initial={{ opacity: 0, scale: 0.6 }}
            transition={{
              ...fade.fast,
              delay: index * stagger,
              scale: { ...spring.pop, delay: index * stagger },
            }}
          >
            <StatusIcon status={state} />
          </m.span>
        </AnimatePresence>
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

  const complete =
    list.length > 0 && list.every(({ status }) => status === 'done');

  const [folded] = useState(complete);

  const [open, setOpen] = useState(!complete);

  useEffect(() => {
    if (!complete || folded) {
      return undefined;
    }

    const timer = setTimeout(() => setOpen(false), FOLD_DELAY_MS);

    return () => clearTimeout(timer);
  }, [complete, folded]);

  if (list.length === 0) {
    return undefined;
  }

  return (
    <Card className='gap-0 py-3.5' variant='inset'>
      <TraceCollapsible onOpenChange={setOpen} open={open}>
        <CollapsibleTrigger className='group/lanes flex w-full items-center gap-2 rounded-control text-left text-sm'>
          <Split aria-hidden='true' className='size-4 text-muted-foreground' />
          <span className='font-medium'>{plural(list.length, 'subagent')}</span>
          <ProgressCount
            className='ml-auto'
            done={finished(list)}
            total={list.length}
          />
          <ChevronRight
            aria-hidden='true'
            className='size-4 text-muted-foreground transition-transform group-aria-expanded/lanes:rotate-90'
          />
        </CollapsibleTrigger>
        <TraceCollapsibleContent className='mt-2 mb-0 ml-0 border-l-0 pr-0 pl-0'>
          <ul className='flex flex-col'>
            {list.map((subagent, index) => (
              <li key={index} className='flex min-w-0 flex-col'>
                <Row active={view.active} index={index} subagent={subagent} />
              </li>
            ))}
          </ul>
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Card>
  );
}

export const delegateRenderers = {
  delegate: {
    icon: Split,
    inline: (view) => <Subagents {...view} />,
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
