import { Button } from '@/components/ui/button';
import type { useComposer } from '@/hooks/use-composer';
import { ArrowUp, LoaderCircle, Square } from 'lucide-react';
import type { ReactElement } from 'react';

export type ComposerMode =
  'ready' | 'submitting' | 'running' | 'stopping' | 'disabled' | 'read-only';

export type ComposerControl =
  | { mode: 'running' | 'stopping'; onStop: () => void }
  | {
      mode: Exclude<ComposerMode, 'running' | 'stopping'>;
      onStop?: never;
    };

type Props = {
  draft: ReturnType<typeof useComposer>;
  onSend: (text: string) => Promise<boolean>;
} & ComposerControl;

const labels = {
  ready: null,
  submitting: 'Sending your message…',
  running: 'Lab is working on it',
  stopping: 'Stopping response…',
  disabled: null,
  'read-only': 'View only',
} satisfies Record<ComposerMode, string | null>;

export function Composer({ draft, onSend, ...control }: Props) {
  const { mode } = control;

  const canSubmit = mode === 'ready' && !!draft.text.trim();

  const label = labels[mode];

  async function submit() {
    if (!canSubmit) {
      return;
    }

    const text = draft.text.trim();

    if (await onSend(text)) {
      draft.setText((current) => (current.trim() === text ? '' : current));
    }
  }

  return (
    <div className='w-full'>
      <form
        className='rounded-[1.5rem] border border-border/90 bg-card p-3 shadow-[0_4px_24px_-12px_rgb(0_0_0/0.16)] sm:p-4'
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <textarea
          ref={draft.textarea}
          aria-label='Message Lab'
          placeholder={
            mode === 'read-only'
              ? 'You have view-only access to this chat'
              : 'Ask anything, or start with an idea…'
          }
          value={draft.text}
          onChange={(event) => draft.setText(event.target.value)}
          disabled={mode === 'read-only' || mode === 'submitting'}
          rows={1}
          className='block max-h-60 min-h-14 w-full resize-none bg-transparent px-1 pt-1 text-base leading-7 outline-none placeholder:text-muted-foreground/80 focus-visible:outline-none disabled:opacity-60 sm:text-[15px]'
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              void submit();
            }
          }}
        />
        <div className='mt-2 flex items-center justify-end gap-3'>
          {label && (
            <span className='mr-auto pl-1 text-xs text-muted-foreground'>
              {label}
            </span>
          )}
          <ComposerAction control={control} canSubmit={canSubmit} />
        </div>
      </form>
    </div>
  );
}

function ComposerAction({
  control,
  canSubmit,
}: {
  control: ComposerControl;
  canSubmit: boolean;
}): ReactElement {
  switch (control.mode) {
    case 'running':
    case 'stopping':
      return (
        <Button
          type='button'
          size='icon'
          className='size-9 rounded-full'
          aria-label={
            control.mode === 'stopping' ? 'Stopping response' : 'Stop response'
          }
          title='Stop response'
          onClick={control.onStop}
          disabled={control.mode === 'stopping'}
        >
          {control.mode === 'stopping' ? (
            <LoaderCircle className='motion-safe:animate-spin' />
          ) : (
            <Square className='size-3.5 fill-current' />
          )}
        </Button>
      );
    case 'submitting':
      return (
        <Button
          type='button'
          size='icon'
          className='size-9 rounded-full'
          disabled
          aria-label='Sending message'
        >
          <LoaderCircle className='motion-safe:animate-spin' />
        </Button>
      );
    case 'ready':
    case 'disabled':
    case 'read-only':
      return (
        <Button
          type='submit'
          size='icon'
          className='size-9 rounded-full'
          disabled={!canSubmit}
          aria-label='Send message'
          title='Send message'
        >
          <ArrowUp className='size-5' />
        </Button>
      );
  }
}
