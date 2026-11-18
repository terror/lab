import { DocumentThumbnail } from '@/components/document-card';
import { ErrorMessage } from '@/components/error-message';
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
  textLimit,
} from '@/lib/attachments';
import {
  type CommandContext,
  type SlashCommand,
  matchCommands,
} from '@/lib/commands';
import { useDictation } from '@/lib/dictation';
import type { LibraryItem } from '@/lib/library';
import { useMediaQuery } from '@/lib/media';
import { type ModelChoice, modelsQueryOptions } from '@/lib/models';
import { useAdmin } from '@/lib/profile';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  ArrowUp,
  CornerDownRight,
  FileText,
  LibraryBig,
  Mic,
  Paperclip,
  Plus,
  Square,
  X,
} from 'lucide-react';
import {
  lazy,
  Suspense,
  useRef,
  useState,
  type ClipboardEvent,
  type Dispatch,
  type KeyboardEvent,
  type Ref,
  type SetStateAction,
  type SubmitEvent,
} from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { toast } from 'sonner';

const LibraryPicker = lazy(async () => ({
  default: (await import('@/components/library-picker')).LibraryPicker,
}));

const MAX_ATTACHMENTS = 8;

const noCommandContext: CommandContext = {
  conversationId: undefined,
  lastReply: undefined,
  newChat: undefined,
};

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
      {attachment.type === 'file' && attachment.uploadId && (
        <div className='flex h-16 max-w-56 items-center gap-3 overflow-hidden rounded-xl border pr-3 text-sm'>
          <DocumentThumbnail
            className='flex h-full w-12 shrink-0 items-center justify-center border-r bg-white object-cover object-top'
            uploadId={attachment.uploadId}
          />
          <span className='truncate'>{attachment.name}</span>
        </div>
      )}
      {attachment.type === 'file' && !attachment.uploadId && (
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

function NoModels() {
  const admin = useAdmin();

  if (!admin) {
    return (
      <p className='mt-2 px-4 text-sm text-muted-foreground'>
        Lab doesn’t have any models yet. Ask the admin to add a provider.
      </p>
    );
  }

  return (
    <p className='mt-2 px-4 text-sm text-muted-foreground'>
      Add a model provider in{' '}
      <Link
        className='font-medium text-foreground underline-offset-4 hover:underline'
        search={{ section: 'providers' }}
        to='/settings'
      >
        Settings → Providers
      </Link>{' '}
      to start chatting.
    </p>
  );
}

function DictateButton({
  disabled,
  listening,
  onClick,
}: {
  disabled: boolean;
  listening: boolean;
  onClick: () => void;
}) {
  const label = listening ? 'Stop dictation' : 'Dictate';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={label}
          aria-pressed={listening}
          className={cn(
            'rounded-full',
            listening &&
              'bg-foreground text-background hover:bg-foreground/90 hover:text-background motion-safe:animate-pulse'
          )}
          disabled={disabled}
          onClick={onClick}
          size='icon'
          type='button'
          variant='ghost'
        >
          <Mic aria-hidden='true' />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function SendButton({
  disabled,
  queueing,
}: {
  disabled: boolean;
  queueing: boolean;
}) {
  const button = (
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

  if (!queueing) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>
        Send after this answer
        <Kbd>↵</Kbd>
      </TooltipContent>
    </Tooltip>
  );
}

export function Composer({
  attachments,
  commandContext = noCommandContext,
  disabled,
  draft,
  error,
  inputRef,
  model,
  onAttachmentsChange,
  onDraftChange,
  onModelChange,
  onSteer,
  onStop,
  onSubmit,
  placeholder = 'Ask anything...',
  running,
  submitting,
}: {
  attachments: Attachment[];
  commandContext?: CommandContext;
  disabled?: boolean;
  draft: string;
  error?: string;
  inputRef?: Ref<HTMLTextAreaElement>;
  model: ModelChoice | undefined;
  onAttachmentsChange: Dispatch<SetStateAction<Attachment[]>>;
  onDraftChange: (draft: string) => void;
  onModelChange: (model: ModelChoice) => void;
  onSteer?: (content: string) => void;
  onStop?: () => void;
  onSubmit: (content: string) => void;
  placeholder?: string;
  running?: boolean;
  submitting?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [attachError, setAttachError] = useState<string>();
  const [picking, setPicking] = useState(false);
  const [pickerOpened, setPickerOpened] = useState(false);
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState<string>();
  const touch = useMediaQuery('(pointer: coarse)');
  const openingPicker = useRef(false);

  const content = draft.trim();
  const empty = !content && attachments.length === 0;

  const dictation = useDictation({ draft, onDraftChange });

  const listening = dictation.state.kind === 'listening';

  const dictationError =
    dictation.state.kind === 'failed' ? dictation.state.message : undefined;

  const steering = running === true && !empty && onSteer !== undefined;

  const stoppable = running === true && onStop !== undefined;

  const room = MAX_ATTACHMENTS - attachments.length;

  const catalog = useQuery(modelsQueryOptions).data?.models;

  const limit = textLimit(
    catalog?.find(
      ({ id, provider }) => id === model?.id && provider === model.provider
    )
  );

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

    dictation.cancel();

    if (steer && onSteer) {
      onSteer(content);
      return;
    }

    onSubmit(content);
  };

  const matches = matchCommands(draft, commandContext);

  const menu = matches.length > 0 && dismissed !== draft;

  const current = Math.min(active, matches.length - 1);

  const selected = matches[current];

  const runCommand = async (command: SlashCommand) => {
    onDraftChange('');
    setActive(0);
    setAttachError(undefined);

    try {
      const message = await command.run(commandContext);

      if (message) {
        toast(message);
      }
    } catch (failure) {
      setAttachError(
        failure instanceof Error ? failure.message : String(failure)
      );
    }
  };

  const onMenuKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const keys: Record<string, () => void> = {
      ArrowDown: () => setActive((current + 1) % matches.length),
      ArrowUp: () => setActive((current - 1 + matches.length) % matches.length),
      Enter: () => selected && void runCommand(selected),
      Escape: () => setDismissed(draft),
      Tab: () => selected && void runCommand(selected),
    };

    const handle = keys[event.key];

    if (!handle || event.shiftKey || event.nativeEvent.isComposing) {
      return false;
    }

    event.preventDefault();
    handle();

    return true;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (menu && onMenuKey(event)) {
      return;
    }

    const command = event.metaKey || event.ctrlKey;

    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing &&
      (command || !touch)
    ) {
      event.preventDefault();
      submit(steering && command);
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = [...event.clipboardData.files];

    if (files.length > 0) {
      event.preventDefault();
      void attach(files, (file) => readAttachment(file, limit));
    }
  };

  const attached = new Set(
    attachments.flatMap(({ libraryId }) =>
      libraryId === undefined ? [] : [libraryId]
    )
  );

  const openPicker = () => {
    openingPicker.current = true;
    setPickerOpened(true);
    setPicking(true);
  };

  const addFromLibrary = async (items: LibraryItem[]) => {
    await attach(items, (item) => readLibraryItem(item, limit));
    setPicking(false);
  };

  const onFormSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit(false);
  };

  return (
    <form onSubmit={onFormSubmit} className='relative w-full'>
      {menu && (
        <div className='absolute inset-x-2 bottom-full mb-2 flex flex-col gap-0.5 rounded-2xl bg-popover p-1.5 shadow-lg ring-1 ring-foreground/10'>
          <ul aria-label='Commands' className='flex flex-col gap-0.5'>
            {matches.map((command) => (
              <li key={command.name}>
                <button
                  aria-current={command === selected ? 'true' : undefined}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60',
                    command === selected && 'bg-muted'
                  )}
                  onClick={() => void runCommand(command)}
                  onMouseDown={(event) => event.preventDefault()}
                  type='button'
                >
                  <command.icon
                    aria-hidden='true'
                    className='size-4 shrink-0 text-muted-foreground'
                  />
                  <span className='font-medium'>/{command.name}</span>
                  <span className='truncate text-muted-foreground'>
                    {command.description}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className='flex gap-3.5 px-3 pt-1 pb-0.5 text-xs text-muted-foreground'>
            <span>↑↓ to choose</span>
            <span>↵ to run</span>
            <span>esc to close</span>
          </p>
        </div>
      )}
      <div className='flex flex-col rounded-3xl border bg-background shadow-sm focus-ring-within'>
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
          className='max-h-72 resize-none bg-transparent px-5 pt-4 pb-2 leading-relaxed placeholder:text-muted-foreground disabled:opacity-50'
          disabled={disabled}
          maxRows={12}
          minRows={1}
          onChange={(event) => {
            if (listening) {
              dictation.cancel();
            }

            onDraftChange(event.target.value);
          }}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          placeholder={placeholder}
          ref={inputRef}
          value={draft}
        />
        <div className='flex items-center gap-2 px-3 pb-3'>
          <input
            className='hidden'
            multiple
            onChange={(event) => {
              void attach([...(event.target.files ?? [])], (file) =>
                readAttachment(file, limit)
              );
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
            <DropdownMenuContent
              align='start'
              onCloseAutoFocus={(event) => {
                if (openingPicker.current) {
                  openingPicker.current = false;
                  event.preventDefault();
                }
              }}
              side='top'
            >
              <DropdownMenuItem onSelect={() => input.current?.click()}>
                <Paperclip aria-hidden='true' />
                Add photos & files
                <span className='text-muted-foreground'>
                  Upload from computer
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={openPicker}>
                <LibraryBig aria-hidden='true' />
                Add from library
                <span className='text-muted-foreground'>
                  Browse and search your files
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {pickerOpened && (
            <Suspense fallback={null}>
              <LibraryPicker
                attached={attached}
                limit={room}
                onAdd={addFromLibrary}
                onOpenChange={setPicking}
                open={picking}
              />
            </Suspense>
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
            {dictation.supported && (
              <DictateButton
                disabled={disabled === true}
                listening={listening}
                onClick={listening ? dictation.stop : dictation.start}
              />
            )}
            {(!stoppable || !empty) && (
              <SendButton
                disabled={disabled || empty || submitting === true}
                queueing={stoppable}
              />
            )}
            {stoppable && (
              <Button
                aria-label='Stop'
                className='rounded-full'
                onClick={onStop}
                size='icon'
                type='button'
              >
                <Square aria-hidden='true' className='size-3 fill-current' />
              </Button>
            )}
          </div>
        </div>
      </div>
      {(attachError ?? dictationError ?? error) && (
        <ErrorMessage className='mt-2 px-4'>
          {attachError ?? dictationError ?? error}
        </ErrorMessage>
      )}
      {catalog?.length === 0 && <NoModels />}
    </form>
  );
}
