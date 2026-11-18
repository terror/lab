import { CommandMenu, useCommandMenu } from '@/components/command-menu';
import {
  AttachMenu,
  AttachmentPreviews,
  useAttachmentIntake,
} from '@/components/composer-attachments';
import { ErrorMessage } from '@/components/error-message';
import { ModelPicker } from '@/components/model-picker';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Kbd } from '@/components/ui/kbd';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Attachment } from '@/lib/attachments';
import { type CommandContext, type SlashCommand } from '@/lib/commands';
import { useDictation } from '@/lib/dictation';
import { useMediaQuery } from '@/lib/media';
import { type ModelChoice, modelsQueryOptions } from '@/lib/models';
import { fade, spring } from '@/lib/motion';
import { useAdmin } from '@/lib/profile';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowUp, CornerDownRight, Mic, Square } from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import {
  useState,
  type Dispatch,
  type KeyboardEvent,
  type Ref,
  type SetStateAction,
  type SubmitEvent,
} from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { toast } from 'sonner';

const noCommandContext: CommandContext = {
  conversationId: undefined,
  lastReply: undefined,
  newChat: undefined,
};

function NoModels() {
  const admin = useAdmin();
  const catalog = useQuery(modelsQueryOptions).data?.models;

  if (catalog?.length !== 0) {
    return null;
  }

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
  return (
    <IconButton
      aria-pressed={listening}
      className={cn(
        'rounded-full',
        listening &&
          'bg-foreground text-background hover:bg-foreground/90 hover:text-background motion-safe:animate-pulse'
      )}
      disabled={disabled}
      label={listening ? 'Stop dictation' : 'Dictate'}
      onClick={onClick}
    >
      <Mic aria-hidden='true' />
    </IconButton>
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
  const [attachError, setAttachError] = useState<string>();
  const touch = useMediaQuery('(pointer: coarse)');

  const content = draft.trim();
  const empty = !content && attachments.length === 0;

  const dictation = useDictation({ draft, onDraftChange });

  const listening = dictation.state.kind === 'listening';

  const dictationError =
    dictation.state.kind === 'failed' ? dictation.state.message : undefined;

  const steering = running === true && !empty && onSteer !== undefined;

  const stoppable = running === true && onStop !== undefined;

  const intake = useAttachmentIntake({
    attachments,
    model,
    onAttachmentsChange,
    onError: setAttachError,
  });

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

  const runCommand = async (command: SlashCommand) => {
    onDraftChange('');
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

  const commands = useCommandMenu(
    draft,
    commandContext,
    (command) => void runCommand(command)
  );

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (commands.onKeyDown(event)) {
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

  const onFormSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit(false);
  };

  return (
    <form onSubmit={onFormSubmit} className='relative w-full'>
      {commands.open && (
        <CommandMenu
          id={commands.id}
          matches={commands.matches}
          onRun={commands.run}
          selected={commands.selected}
        />
      )}
      <div className='flex flex-col rounded-3xl border bg-background shadow-sm focus-ring-within'>
        <AttachmentPreviews
          attachments={attachments}
          onAttachmentsChange={onAttachmentsChange}
        />
        <TextareaAutosize
          {...commands.textbox}
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
          onPaste={intake.onPaste}
          placeholder={placeholder}
          ref={inputRef}
          value={draft}
        />
        <div className='flex items-center gap-2 px-3 pb-3'>
          <AttachMenu disabled={disabled} intake={intake} />
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
      <NoModels />
    </form>
  );
}
