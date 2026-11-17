import { Check, Code, LoaderCircle, X } from 'lucide-react';

import { field, parse, plural, text } from './format';
import { Block } from './previews';
import { toolRenderer } from './registry';
import { type ToolRenderer, type ToolView } from './types';

type NestedCall = {
  args: string;
  id: number;
  name: string;
  status: 'cancelled' | 'error' | 'ok' | 'running';
};

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
              callId: String(call.id),
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
