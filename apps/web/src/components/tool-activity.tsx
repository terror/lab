import type { SessionTool } from '@lab/app-protocol';
import { Wrench } from 'lucide-react';

const labels = {
  pending: 'Pending',
  running: 'Running',
  waiting: 'Waiting',
  completing: 'Completing',
  finished: 'Finished',
  unknown: 'Unknown',
} satisfies Record<SessionTool['status'], string>;

export function ToolActivity({ tools }: { tools: SessionTool[] }) {
  if (tools.length === 0) {
    return null;
  }

  return (
    <details className='mt-8 rounded-xl border p-4'>
      <summary className='cursor-pointer text-sm font-medium'>
        Tool activity ({tools.length})
      </summary>

      <ul className='mt-4 space-y-3'>
        {tools.map((tool) => (
          <li key={tool.id} className='flex items-center gap-2 text-sm'>
            <Wrench
              aria-hidden='true'
              className='size-3.5 text-muted-foreground'
            />

            <span className='min-w-0 flex-1 break-words'>{tool.name}</span>

            <span className='text-xs text-muted-foreground'>
              {labels[tool.status]}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
