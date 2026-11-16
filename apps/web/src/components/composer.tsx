import { ModelPicker } from '@/components/model-picker';
import { Button } from '@/components/ui/button';
import {
  type Attachment,
  imageSource,
  readAttachment,
} from '@/lib/attachments';
import type { ModelChoice } from '@/lib/models';
import { ArrowUp, FileText, Paperclip, Square, X } from 'lucide-react';
import {
  type ClipboardEvent,
  type KeyboardEvent,
  type SubmitEvent,
  useRef,
  useState,
} from 'react';
import TextareaAutosize from 'react-textarea-autosize';

const MAX_ATTACHMENTS = 8;

function AttachmentPreview({
  attachment,
  onRemove,
}: {
  attachment: Attachment;
  onRemove: () => void;
}) {
  return (
    <div className='group relative'>
      {attachment.type === 'image' && (
        <img
          alt={attachment.name}
          className='size-16 rounded-xl border object-cover'
          src={imageSource(attachment)}
        />
      )}
      {attachment.type === 'file' && (
        <div className='flex h-16 max-w-48 items-center gap-2 rounded-xl border px-3 text-sm'>
          <FileText aria-hidden='true' className='size-4 shrink-0' />
          <span className='truncate'>{attachment.name}</span>
        </div>
      )}
      <button
        aria-label={`Remove ${attachment.name}`}
        className='absolute -top-1.5 -right-1.5 rounded-full border bg-background p-0.5 text-muted-foreground hover:text-foreground'
        onClick={onRemove}
        type='button'
      >
        <X aria-hidden='true' className='size-3' />
      </button>
    </div>
  );
}

function SubmitButton({
  disabled,
  onStop,
  stopping,
}: {
  disabled: boolean;
  onStop: (() => void) | undefined;
  stopping: boolean;
}) {
  if (stopping) {
    return (
      <Button
        aria-label='Stop'
        className='rounded-full'
        onClick={onStop}
        size='icon'
        type='button'
      >
        <Square aria-hidden='true' className='fill-current' />
      </Button>
    );
  }

  return (
    <Button
      aria-label='Send'
      className='rounded-full'
      disabled={disabled}
      size='icon'
      type='submit'
    >
      <ArrowUp aria-hidden='true' />
    </Button>
  );
}

export function Composer({
  attachments,
  disabled,
  draft,
  error,
  model,
  onAttachmentsChange,
  onDraftChange,
  onModelChange,
  onStop,
  onSubmit,
  running,
  submitting,
}: {
  attachments: Attachment[];
  disabled?: boolean;
  draft: string;
  error?: string;
  model: ModelChoice | undefined;
  onAttachmentsChange: (attachments: Attachment[]) => void;
  onDraftChange: (draft: string) => void;
  onModelChange: (model: ModelChoice) => void;
  onStop?: () => void;
  onSubmit: (content: string) => void;
  running?: boolean;
  submitting?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [attachError, setAttachError] = useState<string>();

  const content = draft.trim();
  const empty = !content && attachments.length === 0;

  const attach = async (files: File[]) => {
    setAttachError(undefined);

    const room = MAX_ATTACHMENTS - attachments.length;

    const results = await Promise.allSettled(
      files.slice(0, room).map(readAttachment)
    );

    const added = results.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : []
    );

    const failed = results.find((result) => result.status === 'rejected');

    if (failed) {
      setAttachError(
        String(
          failed.reason instanceof Error ? failed.reason.message : failed.reason
        )
      );
    }

    if (files.length > room) {
      setAttachError(`You can attach up to ${MAX_ATTACHMENTS} files`);
    }

    onAttachmentsChange([...attachments, ...added]);
  };

  const submit = () => {
    if (!empty && !submitting) {
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

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = [...event.clipboardData.files];

    if (files.length > 0) {
      event.preventDefault();
      void attach(files);
    }
  };

  const onFormSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  };

  return (
    <form onSubmit={onFormSubmit} className='w-full'>
      <div className='flex flex-col rounded-3xl border bg-background shadow-sm'>
        {attachments.length > 0 && (
          <div className='flex flex-wrap gap-2 px-4 pt-4'>
            {attachments.map((attachment, index) => (
              <AttachmentPreview
                key={`${attachment.name}-${index}`}
                attachment={attachment}
                onRemove={() =>
                  onAttachmentsChange(
                    attachments.filter((_, other) => other !== index)
                  )
                }
              />
            ))}
          </div>
        )}
        <TextareaAutosize
          aria-label='Message'
          className='max-h-72 resize-none bg-transparent px-5 pt-4 pb-2 leading-relaxed outline-none placeholder:text-muted-foreground disabled:opacity-50'
          disabled={disabled}
          maxRows={12}
          minRows={1}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          placeholder='Ask anything...'
          value={draft}
        />
        <div className='flex items-center gap-2 px-3 pb-3'>
          <input
            className='hidden'
            multiple
            onChange={(event) => {
              void attach([...(event.target.files ?? [])]);
              event.target.value = '';
            }}
            ref={input}
            type='file'
          />
          <Button
            aria-label='Attach files'
            className='rounded-full text-muted-foreground'
            disabled={disabled || attachments.length >= MAX_ATTACHMENTS}
            onClick={() => input.current?.click()}
            size='icon'
            type='button'
            variant='ghost'
          >
            <Paperclip aria-hidden='true' />
          </Button>
          <div className='ml-auto flex items-center gap-2'>
            <ModelPicker
              disabled={disabled}
              onChange={onModelChange}
              value={model}
            />
            <SubmitButton
              disabled={disabled || empty || submitting === true}
              onStop={onStop}
              stopping={running === true && empty && onStop !== undefined}
            />
          </div>
        </div>
      </div>
      {(error ?? attachError) && (
        <p role='alert' className='mt-2 px-4 text-sm text-destructive'>
          {error ?? attachError}
        </p>
      )}
    </form>
  );
}
