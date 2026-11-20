import { ModelPicker } from '@/components/model-picker';
import { IconButton } from '@/components/ui/icon-button';
import { MessageFooter } from '@/components/ui/message';
import type { ModelChoice } from '@/lib/models';
import { useMoment } from '@/lib/moment';
import { cn } from '@/lib/utils';
import { RotateCcw, Shuffle, Square, Volume2 } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';

function plain(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`#>~|]/g, '');
}

function CopyIcon({ copied, still }: { copied: boolean; still: boolean }) {
  return (
    <svg
      aria-hidden='true'
      className='size-4 overflow-visible'
      data-still={still || undefined}
      data-slot='copy-icon'
      data-state={copied ? 'copied' : 'idle'}
      fill='none'
      stroke='currentColor'
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth='2'
      viewBox='0 0 24 24'
    >
      <path
        d='M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'
        data-part='back'
      />
      <rect data-part='front' height='14' rx='2' width='14' x='8' y='8' />
      <path d='M20 6 9 17l-5-5' data-part='check' pathLength='1' />
    </svg>
  );
}

function CopyAction({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const fold = useMoment('copy.fold').on;

  useEffect(() => {
    if (!copied) {
      return undefined;
    }

    const timer = window.setTimeout(() => setCopied(false), 1_600);

    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <>
      <IconButton
        className={cn(copied && 'text-foreground')}
        label={copied ? 'Copied' : 'Copy'}
        onClick={() => {
          void navigator.clipboard.writeText(text).then(() => setCopied(true));
        }}
      >
        <CopyIcon copied={copied} still={!fold} />
      </IconButton>
      <span aria-live='polite' className='sr-only'>
        {copied ? 'Copied' : ''}
      </span>
    </>
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
    <IconButton
      label={speaking ? 'Stop reading' : 'Read aloud'}
      onClick={toggle}
    >
      {speaking ? (
        <Square aria-hidden='true' className='size-3.5 fill-current' />
      ) : (
        <Volume2 aria-hidden='true' className='size-4' />
      )}
    </IconButton>
  );
}

export type Retry = (model?: ModelChoice) => void;

function RetryActions({
  model,
  onRetry,
  spin,
}: {
  model: ModelChoice | undefined;
  onRetry: Retry;
  spin: boolean;
}) {
  const [turns, setTurns] = useState(0);
  const spins = useMoment('retry.spin').on;

  return (
    <>
      <IconButton
        label='Retry'
        onClick={() => {
          setTurns((count) => count + 1);
          onRetry();
        }}
      >
        <RotateCcw
          key={turns}
          aria-hidden='true'
          className={cn(
            'size-4',
            turns > 0 && spin && spins && 'motion-safe:animate-retry'
          )}
        />
      </IconButton>
      <ModelPicker
        onChange={onRetry}
        trigger={
          <IconButton label='Retry with another model'>
            <Shuffle aria-hidden='true' className='size-4' />
          </IconButton>
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
  spin,
  text,
  versions,
}: {
  latest: boolean;
  model: ModelChoice | undefined;
  onRetry: Retry | undefined;
  spin: boolean;
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
        {onRetry && (
          <RetryActions model={model} onRetry={onRetry} spin={spin} />
        )}
      </div>
    </MessageFooter>
  );
}
