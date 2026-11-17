import { Markdown } from '@/components/markdown';
import {
  ToolBody,
  ToolHistory,
  type ToolProgress,
  toolRenderer,
  type ToolResult,
} from '@/components/tools';
import {
  Message,
  MessageContent,
  MessageFooter,
} from '@/components/ui/message';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from '@/components/ui/trace';
import { cn } from '@/lib/utils';
import { Check, Copy, Square, TriangleAlert, Volume2 } from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import { type ReactNode, useContext, useEffect, useRef, useState } from 'react';

type Part =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string; redacted?: boolean }
  | {
      type: 'toolCall';
      id: string;
      name: string;
      arguments: Record<string, unknown>;
    };

export type { ToolProgress, ToolResult };

type Segment =
  | { calls: Extract<Part, { type: 'toolCall' }>[]; key: string; kind: 'tools' }
  | { index: number; key: string; kind: 'text'; text: string };

function segments(parts: readonly Part[]) {
  return parts.reduce<Segment[]>((grouped, part, index) => {
    const last = grouped.at(-1);

    if (part.type === 'toolCall') {
      if (last?.kind === 'tools') {
        return [
          ...grouped.slice(0, -1),
          { ...last, calls: [...last.calls, part] },
        ];
      }

      return [...grouped, { calls: [part], key: part.id, kind: 'tools' }];
    }

    if (part.type !== 'text' || !part.text) {
      return grouped;
    }

    return [
      ...grouped,
      { index, key: `text-${index}`, kind: 'text', text: part.text },
    ];
  }, []);
}

const statuses: Record<string, 'error' | 'running' | undefined> = {
  'false-false': undefined,
  'false-true': 'running',
  'true-false': 'error',
  'true-true': 'error',
};

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

  const history = useContext(ToolHistory);

  const view = {
    active,
    args: call.arguments,
    callId: call.id,
    details: result?.details ?? progress?.details,
    history,
    output: result?.output ?? progress?.output ?? '',
  };

  const renderer = toolRenderer(call.name);

  const Icon = failed ? TriangleAlert : renderer.icon;

  const summary = renderer.summary?.(view);

  const status = statuses[`${failed}-${active}`];

  return (
    <Trace className='gap-0'>
      <TraceCollapsible>
        <TraceCollapsibleTrigger>
          <TraceLine className='h-6.5' status={status}>
            <TraceIcon>
              <Icon aria-hidden='true' />
            </TraceIcon>
            <TraceTitle>{renderer.title(view)}</TraceTitle>
            {summary && (
              <span className='shrink-0 text-muted-foreground/70'>
                · {summary}
              </span>
            )}
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent className='mt-1.5 mb-2 ml-0 flex flex-col gap-3 border-l-0 pl-0'>
          <ToolBody {...view} name={call.name} />
        </TraceCollapsibleContent>
      </TraceCollapsible>
      {renderer.inline && (
        <div className='mt-1.5 mb-2'>{renderer.inline(view)}</div>
      )}
    </Trace>
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
    <MessageFooter
      className={cn(
        'gap-0.5 px-0 transition-opacity',
        !latest &&
          'opacity-0 group-hover/message:opacity-100 focus-within:opacity-100'
      )}
    >
      <CopyAction text={text} />
      {'speechSynthesis' in window && <SpeakAction text={text} />}
    </MessageFooter>
  );
}

export function Activity({ status: label }: { status: string }) {
  return (
    <output className='flex'>
      <AnimatePresence initial={false} mode='wait'>
        <m.span
          key={label}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          initial={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.2 }}
        >
          <TraceLine status='running'>
            <TraceTitle>{label}</TraceTitle>
          </TraceLine>
        </m.span>
      </AnimatePresence>
    </output>
  );
}

export function replyText(parts: readonly Part[]) {
  return parts
    .slice(parts.findLastIndex(({ type }) => type === 'toolCall') + 1)
    .flatMap((part) => (part.type === 'text' && part.text ? [part.text] : []))
    .join('\n\n');
}

export function AssistantMessage({
  activity,
  latest = false,
  parts,
  progress,
  results,
  streaming,
}: {
  activity?: string;
  latest?: boolean;
  parts: readonly Part[];
  progress: ReadonlyMap<string, ToolProgress>;
  results: ReadonlyMap<string, ToolResult>;
  streaming: boolean;
}) {
  const text = replyText(parts);

  const answer = !streaming && text.length > 0;

  return (
    <Message>
      <MessageContent className='gap-3 text-base'>
        {segments(parts).map((segment) => {
          if (segment.kind === 'tools') {
            return (
              <div key={segment.key} className='flex flex-col'>
                {segment.calls.map((call) => (
                  <ToolCall
                    key={call.id}
                    call={call}
                    progress={progress.get(call.id)}
                    result={results.get(call.id)}
                  />
                ))}
              </div>
            );
          }

          return (
            <Markdown
              key={segment.key}
              streaming={streaming && segment.index === parts.length - 1}
            >
              {segment.text}
            </Markdown>
          );
        })}
        {activity !== undefined && <Activity status={activity} />}
        {answer && <MessageActions latest={latest} text={text} />}
      </MessageContent>
    </Message>
  );
}
