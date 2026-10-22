import { CopyButton } from '@/components/copy-button';
import { cn } from '@/lib/utils';
import type { ChatToolPart } from '@lab/shared';
import { Check, ChevronDown, CircleAlert, LoaderCircle } from 'lucide-react';

export function ToolCall({ part }: { part: ChatToolPart }) {
  const running = part.status === 'preparing' || part.status === 'running';
  const failed = part.status === 'error';
  const Icon = running ? LoaderCircle : failed ? CircleAlert : Check;
  const status = running ? 'Running' : failed ? 'Failed' : 'Done';
  const preview = Object.values(part.input).find(
    (value) => typeof value === 'string'
  );
  const output = toolOutput(part);

  return (
    <details className='group/tool overflow-hidden rounded-lg border border-border/60 bg-muted/20'>
      <summary className='flex cursor-pointer list-none items-center gap-2 px-3 py-2 select-none hover:bg-muted/50 [&::-webkit-details-marker]:hidden'>
        <span role='status' aria-label={status}>
          <Icon
            className={cn(
              'size-3.5 shrink-0',
              running && 'text-muted-foreground motion-safe:animate-spin',
              failed && 'text-destructive',
              !running && !failed && 'text-emerald-600 dark:text-emerald-400'
            )}
          />
        </span>
        <span className='max-w-40 shrink-0 truncate text-xs font-medium'>
          {part.name}
        </span>
        <span className='min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground'>
          {preview}
        </span>
        <ChevronDown className='size-3 shrink-0 text-muted-foreground transition-transform group-open/tool:rotate-180' />
      </summary>
      <div className='space-y-3 border-t border-border/60 px-3 py-3 text-xs'>
        <div>
          <p className='mb-1.5 text-muted-foreground'>Input</p>
          <pre className='max-h-48 overflow-auto font-mono leading-5 break-words whitespace-pre-wrap'>
            {JSON.stringify(part.input, null, 2)}
          </pre>
        </div>
        <div>
          <div className='mb-1.5 flex items-center justify-between text-muted-foreground'>
            <span>{failed ? 'Error' : 'Output'}</span>
            {output && <CopyButton text={output} />}
          </div>
          <pre
            className={cn(
              'max-h-72 overflow-auto font-mono leading-5 break-words whitespace-pre-wrap',
              failed && 'text-destructive',
              !output && 'text-muted-foreground'
            )}
          >
            {output || (running ? 'Waiting for a result…' : 'Completed')}
          </pre>
        </div>
      </div>
    </details>
  );
}

function toolOutput(part: ChatToolPart): string {
  if (part.status === 'error') {
    return part.message;
  }

  if (part.status === 'preparing' || !part.output) {
    return '';
  }

  return (
    part.output.text ||
    (part.output.details === undefined
      ? ''
      : JSON.stringify(part.output.details, null, 2))
  );
}
