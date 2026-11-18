import { StatusIcon } from '@/components/ui/status-icon';
import { plural } from '@/lib/format';
import { Code } from 'lucide-react';

import { field, parse, text } from './format';
import { Block } from './previews';
import { toolRenderer } from './registry';
import { type ToolRenderer, type ToolView } from './types';

type NestedCall = {
  args: string;
  id: number;
  name: string;
  status: 'cancelled' | 'error' | 'ok' | 'running';
};

const statuses = {
  cancelled: 'stopped',
  error: 'failed',
  ok: 'done',
  running: 'running',
} as const;

function Script({ args, details, output }: ToolView) {
  const calls = (field(details, 'calls') as NestedCall[] | undefined) ?? [];

  return (
    <>
      {calls.length > 0 && (
        <ul className='flex flex-col gap-1 text-sm text-muted-foreground'>
          {calls.map((call) => {
            const view = {
              active: call.status === 'running',
              args: parse(call.args),
              callId: String(call.id),
              details: undefined,
              history: [],
              output: '',
            };

            return (
              <li key={call.id} className='flex items-center gap-2'>
                <span className='flex size-4 shrink-0 items-center justify-center'>
                  <StatusIcon status={statuses[call.status]} />
                </span>
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

export const codemodeRenderers = {
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
} satisfies Record<string, ToolRenderer>;
