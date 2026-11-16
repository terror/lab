import { Markdown } from '@/components/markdown';
import { cn } from '@/lib/utils';
import {
  ChevronRight,
  LoaderCircle,
  TriangleAlert,
  Wrench,
} from 'lucide-react';

type Part =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string; redacted?: boolean }
  | {
      type: 'toolCall';
      id: string;
      name: string;
      arguments: Record<string, unknown>;
    };

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

function ToolOutput({ output }: { output: string }) {
  if (!output) {
    return null;
  }

  return (
    <pre className='max-h-64 overflow-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap'>
      {output}
    </pre>
  );
}

function ToolCall({
  call,
  progress,
  result,
}: {
  call: Extract<Part, { type: 'toolCall' }>;
  progress: ToolProgress | undefined;
  result: ToolResult | undefined;
}) {
  const active = result === undefined;
  const failed = result?.isError ?? false;
  const label = active ? `Running ${call.name}` : `Ran ${call.name}`;

  return (
    <details className='group text-sm text-muted-foreground'>
      <summary className='flex w-fit list-none items-center gap-2 rounded-md py-0.5 hover:text-foreground [&::-webkit-details-marker]:hidden'>
        {active && (
          <LoaderCircle
            aria-hidden='true'
            className='size-4 motion-safe:animate-spin'
          />
        )}
        {!active && failed && (
          <TriangleAlert
            aria-hidden='true'
            className='size-4 text-destructive'
          />
        )}
        {!active && !failed && <Wrench aria-hidden='true' className='size-4' />}
        <span className={cn(active && 'motion-safe:animate-pulse')}>
          {label}
        </span>
        <ChevronRight
          aria-hidden='true'
          className='size-3.5 transition-transform group-open:rotate-90'
        />
      </summary>
      <div className='mt-2 ml-2 border-l pl-4'>
        <ToolOutput output={result?.output ?? progress?.output ?? ''} />
      </div>
    </details>
  );
}

function Thinking({ active, text }: { active: boolean; text: string }) {
  return (
    <details className='group text-sm text-muted-foreground'>
      <summary className='flex w-fit list-none items-center gap-2 py-0.5 hover:text-foreground [&::-webkit-details-marker]:hidden'>
        <span className={cn(active && 'motion-safe:animate-pulse')}>
          {active ? 'Thinking' : 'Thought'}
        </span>
        <ChevronRight
          aria-hidden='true'
          className='size-3.5 transition-transform group-open:rotate-90'
        />
      </summary>
      <div className='mt-2 ml-2 border-l pl-4 leading-relaxed whitespace-pre-wrap'>
        {text}
      </div>
    </details>
  );
}

export function AssistantMessage({
  parts,
  progress,
  results,
  streaming,
}: {
  parts: readonly Part[];
  progress: ReadonlyMap<string, ToolProgress>;
  results: ReadonlyMap<string, ToolResult>;
  streaming: boolean;
}) {
  return (
    <div className='flex flex-col gap-3'>
      {parts.map((part, index) => {
        const last = index === parts.length - 1;

        if (part.type === 'thinking') {
          if (part.redacted || !part.thinking.trim()) {
            return null;
          }

          return (
            <Thinking
              key={index}
              active={streaming && last}
              text={part.thinking}
            />
          );
        }

        if (part.type === 'toolCall') {
          return (
            <ToolCall
              key={part.id}
              call={part}
              progress={progress.get(part.id)}
              result={results.get(part.id)}
            />
          );
        }

        if (!part.text) {
          return null;
        }

        return (
          <Markdown key={index} streaming={streaming && last}>
            {part.text}
          </Markdown>
        );
      })}
    </div>
  );
}
