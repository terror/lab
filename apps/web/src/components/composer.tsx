import { ModelPicker } from '@/components/model-picker';
import { Button } from '@/components/ui/button';
import type { ModelChoice } from '@/lib/models';
import { ArrowUp, Square } from 'lucide-react';
import type { KeyboardEvent, SubmitEvent } from 'react';
import TextareaAutosize from 'react-textarea-autosize';

export function Composer({
  disabled,
  draft,
  error,
  model,
  onDraftChange,
  onModelChange,
  onStop,
  onSubmit,
  running,
  submitting,
}: {
  disabled?: boolean;
  draft: string;
  error?: string;
  model: ModelChoice | undefined;
  onDraftChange: (draft: string) => void;
  onModelChange: (model: ModelChoice) => void;
  onStop?: () => void;
  onSubmit: (content: string) => void;
  running?: boolean;
  submitting?: boolean;
}) {
  const content = draft.trim();

  const submit = () => {
    if (content && !submitting) {
      onSubmit(content);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      submit();
    }
  };

  const onFormSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  };

  const stopping = running && !content && onStop !== undefined;

  return (
    <form onSubmit={onFormSubmit} className='w-full'>
      <div className='flex flex-col rounded-3xl border bg-background shadow-sm'>
        <TextareaAutosize
          aria-label='Message'
          className='max-h-72 resize-none bg-transparent px-5 pt-4 pb-2 leading-relaxed outline-none placeholder:text-muted-foreground disabled:opacity-50'
          disabled={disabled}
          maxRows={12}
          minRows={1}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder='Ask Lab anything'
          value={draft}
        />
        <div className='flex items-center justify-end gap-2 px-3 pb-3'>
          <ModelPicker
            disabled={disabled}
            onChange={onModelChange}
            value={model}
          />
          {stopping ? (
            <Button
              aria-label='Stop'
              className='rounded-full'
              onClick={onStop}
              size='icon'
              type='button'
            >
              <Square aria-hidden='true' className='fill-current' />
            </Button>
          ) : (
            <Button
              aria-label='Send'
              className='rounded-full'
              disabled={disabled || !content || submitting}
              size='icon'
              type='submit'
            >
              <ArrowUp aria-hidden='true' />
            </Button>
          )}
        </div>
      </div>
      {error && (
        <p role='alert' className='mt-2 px-4 text-sm text-destructive'>
          {error}
        </p>
      )}
    </form>
  );
}
