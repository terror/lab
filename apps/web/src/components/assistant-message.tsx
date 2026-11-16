import { Markdown } from '@/components/markdown';
import { cn } from '@/lib/utils';
import {
  ChevronRight,
  Globe,
  LoaderCircle,
  type LucideIcon,
  Search,
  TriangleAlert,
  Wrench,
} from 'lucide-react';
import { z } from 'zod';

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

const searchDetailsSchema = z.object({
  results: z.array(z.object({ title: z.string(), url: z.string() })),
});

const pageDetailsSchema = z.object({ title: z.string(), url: z.string() });

const argumentsSchema = z.object({
  query: z.string().optional(),
  url: z.string().optional(),
});

function hostname(url: string | undefined) {
  if (!url) {
    return 'a page';
  }

  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function describe(
  name: string,
  args: Record<string, unknown>,
  active: boolean
): { icon: LucideIcon; label: string } {
  const { query, url } = argumentsSchema.parse(args);

  if (name === 'web_search') {
    return {
      icon: Search,
      label: `${active ? 'Searching' : 'Searched'} for “${query ?? ''}”`,
    };
  }

  if (name === 'fetch_page') {
    return {
      icon: Globe,
      label: `${active ? 'Reading' : 'Read'} ${hostname(url)}`,
    };
  }

  return { icon: Wrench, label: active ? `Running ${name}` : `Ran ${name}` };
}

function Link({ href, children }: { href: string; children: string }) {
  return (
    <a
      className='truncate text-foreground underline-offset-4 hover:underline'
      href={href}
      rel='noreferrer'
      target='_blank'
    >
      {children}
    </a>
  );
}

function ToolBody({
  details,
  name,
  output,
}: {
  details: unknown;
  name: string;
  output: string;
}) {
  const search = searchDetailsSchema.safeParse(details);

  if (name === 'web_search' && search.success) {
    return (
      <ul className='flex flex-col gap-1'>
        {search.data.results.map(({ title, url }) => (
          <li key={url} className='flex min-w-0 flex-col'>
            <Link href={url}>{title}</Link>
            <span className='truncate text-xs'>{hostname(url)}</span>
          </li>
        ))}
      </ul>
    );
  }

  const page = pageDetailsSchema.safeParse(details);

  if (name === 'fetch_page' && page.success) {
    return <Link href={page.data.url}>{page.data.title || page.data.url}</Link>;
  }

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
  const { icon: Icon, label } = describe(call.name, call.arguments, active);

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
        {!active && !failed && <Icon aria-hidden='true' className='size-4' />}
        <span className={cn(active && 'motion-safe:animate-pulse')}>
          {label}
        </span>
        <ChevronRight
          aria-hidden='true'
          className='size-3.5 transition-transform group-open:rotate-90'
        />
      </summary>
      <div className='mt-2 ml-2 border-l pl-4'>
        <ToolBody
          details={result?.details ?? progress?.details}
          name={call.name}
          output={result?.output ?? progress?.output ?? ''}
        />
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
