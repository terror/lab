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
import { ListRow } from '@/components/ui/list-row';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
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
import { useMediaQuery, usePhone } from '@/lib/media';
import { type ModelChoice, modelsQueryOptions } from '@/lib/models';
import { fade, spring } from '@/lib/motion';
import { useAdmin } from '@/lib/profile';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  ArrowUp,
  CornerDownRight,
  FileText,
  LibraryBig,
  type LucideIcon,
  Mic,
  Paperclip,
  Plus,
  Square,
  X,
} from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
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
      <Button
        aria-label={`Remove ${attachment.name}`}
        className='absolute -top-2 -right-2 rounded-full shadow-xs'
        onClick={onRemove}
        size='icon-xs'
        type='button'
        variant='secondary'
      >
        <X aria-hidden='true' />
      </Button>
    </div>
  );
}

type Source = { icon: LucideIcon; label: string; run: () => void };

function AttachMenu({
  disabled,
  onCloseAutoFocus,
  sources,
}: {
  disabled: boolean;
  onCloseAutoFocus: (event: Event) => void;
  sources: Source[];
}) {
  const phone = usePhone();
  const [open, setOpen] = useState(false);

  const trigger = (
    <Button
      aria-label='Add photos and files'
      className='rounded-full'
      disabled={disabled}
      size='icon'
      type='button'
      variant='quiet'
    >
      <Plus aria-hidden='true' />
    </Button>
  );

  if (!phone) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        <DropdownMenuContent
          align='start'
          onCloseAutoFocus={onCloseAutoFocus}
          side='top'
        >
          {sources.map(({ icon: Icon, label, run }) => (
            <DropdownMenuItem key={label} onSelect={run}>
              <Icon aria-hidden='true' />
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        className='gap-0 rounded-t-dialog'
        onCloseAutoFocus={onCloseAutoFocus}
        showCloseButton={false}
        side='bottom'
      >
        <SheetHeader className='pb-2'>
          <SheetTitle>Add to your message</SheetTitle>
          <SheetDescription className='sr-only'>
            Attach photos and files
          </SheetDescription>
        </SheetHeader>
        <ul className='px-4 pb-4'>
          {sources.map(({ icon: Icon, label, run }) => (
            <ListRow key={label} asChild>
              <button
                onClick={() => {
                  setOpen(false);
                  run();
                }}
                type='button'
              >
                <Icon
                  aria-hidden='true'
                  className='size-4 text-muted-foreground'
                />
                {label}
              </button>
            </ListRow>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
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
          variant='quiet'
        >
          <Mic aria-hidden='true' />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function QueueButton({ disabled }: { disabled: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label='Send'
          className='rounded-full'
          disabled={disabled}
          size='icon'
          type='submit'
        >
          <ArrowUp aria-hidden='true' />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        Send after this answer
        <Kbd>↵</Kbd>
      </TooltipContent>
    </Tooltip>
  );
}

const actions = {
  send: {
    glyph: <ArrowUp aria-hidden='true' />,
    label: 'Send',
    type: 'submit',
  },
  stop: {
    glyph: <Square aria-hidden='true' className='size-3 fill-current' />,
    label: 'Stop',
    type: 'button',
  },
} as const;

function SendOrStop({
  disabled,
  onStop,
  stopping,
}: {
  disabled: boolean;
  onStop: (() => void) | undefined;
  stopping: boolean;
}) {
  const mode = stopping ? 'stop' : 'send';

  const { glyph, label, type } = actions[mode];

  return (
    <Button
      aria-label={label}
      className='rounded-full'
      disabled={!stopping && disabled}
      onClick={stopping ? onStop : undefined}
      size='icon'
      type={type}
    >
      <AnimatePresence initial={false}>
        <m.span
          key={mode}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className='absolute inset-0 grid place-items-center'
          exit={{ opacity: 0, scale: 0.4, transition: fade.leave, y: -4 }}
          initial={{ opacity: 0, scale: 0.4 }}
          transition={{ ...spring.snap, opacity: fade.fast }}
        >
          {glyph}
        </m.span>
      </AnimatePresence>
    </Button>
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
  placeholder = 'Ask anything…',
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
        <div className='absolute inset-x-2 bottom-full mb-2 flex animate-in flex-col rounded-menu bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-base ease-out fade-in-0 zoom-in-95 slide-in-from-bottom-2'>
          <ul aria-label='Commands' className='flex flex-col'>
            {matches.map((command) => (
              <li key={command.name}>
                <button
                  aria-current={command === selected ? 'true' : undefined}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-sm px-1.5 py-1 text-left text-sm hover:bg-accent hover:text-accent-foreground',
                    command === selected && 'bg-accent text-accent-foreground'
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
          <p className='flex gap-3 px-1.5 pt-1.5 pb-0.5 text-xs text-muted-foreground pointer-coarse:hidden'>
            <span className='flex items-center gap-1'>
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              to choose
            </span>
            <span className='flex items-center gap-1'>
              <Kbd>↵</Kbd>
              to run
            </span>
            <span className='flex items-center gap-1'>
              <Kbd>esc</Kbd>
              to close
            </span>
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
          <AttachMenu
            disabled={disabled || room <= 0}
            onCloseAutoFocus={(event) => {
              if (openingPicker.current) {
                openingPicker.current = false;
                event.preventDefault();
              }
            }}
            sources={[
              {
                icon: Paperclip,
                label: 'Add photos & files',
                run: () => input.current?.click(),
              },
              { icon: LibraryBig, label: 'Add from library', run: openPicker },
            ]}
          />
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
          <div className='ml-auto flex min-w-0 items-center gap-2 pointer-coarse:gap-3'>
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
            {stoppable && !empty && (
              <QueueButton disabled={disabled || submitting === true} />
            )}
            <SendOrStop
              disabled={disabled || empty || submitting === true}
              onStop={onStop}
              stopping={stoppable}
            />
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
