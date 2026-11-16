import { LibraryPicker } from '@/components/library-picker';
import { ModelPicker } from '@/components/model-picker';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Kbd } from '@/components/ui/kbd';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  type Attachment,
  imageSource,
  readAttachment,
  readLibraryItem,
} from '@/lib/attachments';
import type { LibraryItem } from '@/lib/library';
import type { ModelChoice } from '@/lib/models';
import {
  ArrowUp,
  CornerDownRight,
  FileText,
  Images,
  Paperclip,
  Plus,
  Square,
  X,
} from 'lucide-react';
import {
  type ClipboardEvent,
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction,
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
  onSteer,
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
  onAttachmentsChange: Dispatch<SetStateAction<Attachment[]>>;
  onDraftChange: (draft: string) => void;
  onModelChange: (model: ModelChoice) => void;
  onSteer?: (content: string) => void;
  onStop?: () => void;
  onSubmit: (content: string) => void;
  running?: boolean;
  submitting?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [attachError, setAttachError] = useState<string>();
  const [picking, setPicking] = useState(false);

  const content = draft.trim();
  const empty = !content && attachments.length === 0;

  const steering = running === true && !empty && onSteer !== undefined;

  const room = MAX_ATTACHMENTS - attachments.length;

  const attach = async <T,>(
    sources: T[],
    read: (source: T) => Promise<Attachment>
  ) => {
    setAttachError(undefined);

    const results = await Promise.allSettled(sources.slice(0, room).map(read));

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

    if (sources.length > room) {
      setAttachError(`You can attach up to ${MAX_ATTACHMENTS} files`);
    }

    onAttachmentsChange((current) =>
      [...current, ...added].slice(0, MAX_ATTACHMENTS)
    );
  };

  const submit = (steer: boolean) => {
    if (empty || submitting) {
      return;
    }

    if (steer && onSteer) {
      onSteer(content);
      return;
    }

    onSubmit(content);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      submit(steering && (event.metaKey || event.ctrlKey));
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = [...event.clipboardData.files];

    if (files.length > 0) {
      event.preventDefault();
      void attach(files, readAttachment);
    }
  };

  const addFromLibrary = (items: LibraryItem[]) => {
    setPicking(false);
    void attach(items, readLibraryItem);
  };

  const onFormSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit(false);
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
              void attach([...(event.target.files ?? [])], readAttachment);
              event.target.value = '';
            }}
            ref={input}
            type='file'
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label='Add photos and files'
                className='rounded-full text-muted-foreground'
                disabled={disabled || room <= 0}
                size='icon'
                type='button'
                variant='ghost'
              >
                <Plus aria-hidden='true' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='start' className='w-auto' side='top'>
              <DropdownMenuItem onSelect={() => input.current?.click()}>
                <Paperclip aria-hidden='true' />
                Add photos & files
                <span className='text-muted-foreground'>
                  Upload from computer
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setPicking(true)}>
                <Images aria-hidden='true' />
                Add from library
                <span className='text-muted-foreground'>
                  Browse and search your files
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {picking && (
            <LibraryPicker
              limit={room}
              onAdd={addFromLibrary}
              onOpenChange={setPicking}
              open
            />
          )}
          <div className='ml-auto flex min-w-0 items-center gap-2'>
            <ModelPicker
              disabled={disabled}
              onChange={onModelChange}
              value={model}
            />
            {steering && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-keyshortcuts='Meta+Enter'
                    aria-label='Steer'
                    className='rounded-full'
                    disabled={disabled || submitting === true}
                    onClick={() => submit(true)}
                    size='icon'
                    type='button'
                    variant='outline'
                  >
                    <CornerDownRight aria-hidden='true' />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Steer the current answer
                  <Kbd>⌘↵</Kbd>
                </TooltipContent>
              </Tooltip>
            )}
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
