import { ModelPicker } from '@/components/model-picker';
import { Button } from '@/components/ui/button';
import { MessageFooter } from '@/components/ui/message';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { ModelChoice } from '@/lib/models';
import { cn } from '@/lib/utils';
import { Check, Copy, RotateCcw, Shuffle, Square, Volume2 } from 'lucide-react';
import {
  type ComponentProps,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';

function plain(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`#>~|]/g, '');
}

export function Action({
  children,
  label,
  ...props
}: ComponentProps<'button'> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={label}
          size='icon'
          type='button'
          variant='quiet'
          {...props}
        >
          {children}
        </Button>
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

export type Retry = (model?: ModelChoice) => void;

function RetryActions({
  model,
  onRetry,
}: {
  model: ModelChoice | undefined;
  onRetry: Retry;
}) {
  return (
    <>
      <Action label='Retry' onClick={() => onRetry()}>
        <RotateCcw aria-hidden='true' className='size-4' />
      </Action>
      <ModelPicker
        onChange={onRetry}
        trigger={
          <Action label='Retry with another model'>
            <Shuffle aria-hidden='true' className='size-4' />
          </Action>
        }
        value={model}
      />
    </>
  );
}

export function MessageActions({
  latest,
  model,
  onRetry,
  text,
  versions,
}: {
  latest: boolean;
  model: ModelChoice | undefined;
  onRetry: Retry | undefined;
  text: string;
  versions: ReactNode;
}) {
  return (
    <MessageFooter className='gap-0.5 px-0'>
      {versions}
      <div
        className={cn(
          'flex items-center gap-0.5 transition-opacity',
          !latest && 'hover-reveal group-hover/message:opacity-100'
        )}
      >
        {text && <CopyAction text={text} />}
        {text && 'speechSynthesis' in window && <SpeakAction text={text} />}
        {onRetry && <RetryActions model={model} onRetry={onRetry} />}
      </div>
    </MessageFooter>
  );
}
