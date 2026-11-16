import { Markdown } from '@/components/markdown';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  Check,
  ChevronRight,
  Copy,
  LoaderCircle,
  Square,
  TriangleAlert,
  Volume2,
  Wrench,
} from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';

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

function plain(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`#>~|]/g, '');
}

function Action({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-label={label}
          className='flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50'
          onClick={onClick}
          type='button'
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function CopyAction({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return undefined;
    }

    const timer = window.setTimeout(() => setCopied(false), 1_500);

    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <Action
      label={copied ? 'Copied' : 'Copy'}
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => setCopied(true));
      }}
    >
      {copied ? (
        <Check aria-hidden='true' className='size-4' />
      ) : (
        <Copy aria-hidden='true' className='size-4' />
      )}
    </Action>
  );
}

function SpeakAction({ text }: { text: string }) {
  const [speaking, setSpeaking] = useState(false);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(
    () => () => {
      if (utterance.current) {
        window.speechSynthesis.cancel();
      }
    },
    []
  );

  const toggle = () => {
    window.speechSynthesis.cancel();

    if (speaking) {
      return;
    }

    const next = new SpeechSynthesisUtterance(plain(text));

    const done = () => {
      if (utterance.current === next) {
        utterance.current = null;
        setSpeaking(false);
      }
    };

    next.addEventListener('end', done);
    next.addEventListener('error', done);

    utterance.current = next;
    setSpeaking(true);
    window.speechSynthesis.speak(next);
  };

  return (
    <Action label={speaking ? 'Stop reading' : 'Read aloud'} onClick={toggle}>
      {speaking ? (
        <Square aria-hidden='true' className='size-3.5 fill-current' />
      ) : (
        <Volume2 aria-hidden='true' className='size-4' />
      )}
    </Action>
  );
}

function MessageActions({ latest, text }: { latest: boolean; text: string }) {
  return (
    <div
      className={cn(
        '-mt-1 -ml-2 flex items-center gap-0.5 transition-opacity',
        !latest &&
          'opacity-0 group-hover/message:opacity-100 focus-within:opacity-100'
      )}
    >
      <CopyAction text={text} />
      {'speechSynthesis' in window && <SpeakAction text={text} />}
    </div>
  );
}

export function AssistantMessage({
  latest = false,
  parts,
  progress,
  results,
  streaming,
}: {
  latest?: boolean;
  parts: readonly Part[];
  progress: ReadonlyMap<string, ToolProgress>;
  results: ReadonlyMap<string, ToolResult>;
  streaming: boolean;
}) {
  const text = parts
    .flatMap((part) => (part.type === 'text' && part.text ? [part.text] : []))
    .join('\n\n');

  const answer =
    !streaming &&
    text.length > 0 &&
    !parts.some(({ type }) => type === 'toolCall');

  return (
    <div className='group/message flex flex-col gap-3'>
      {parts.map((part, index) => {
        if (part.type === 'thinking') {
          return null;
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
          <Markdown
            key={index}
            streaming={streaming && index === parts.length - 1}
          >
            {part.text}
          </Markdown>
        );
      })}
      {answer && <MessageActions latest={latest} text={text} />}
    </div>
  );
}
