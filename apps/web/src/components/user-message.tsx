import { DocumentCard } from '@/components/document-card';
import { FileChip } from '@/components/file-chip';
import { ImageCard } from '@/components/image-card';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import {
  Message,
  MessageContent,
  MessageFooter,
} from '@/components/ui/message';
import { useMediaQuery } from '@/lib/media';
import type { BubbleFile, UserBubble, Versions } from '@/lib/transcript';
import { uploadUrl } from '@/lib/uploads';
import { Link } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight, Pencil, X } from 'lucide-react';
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useRef,
  useState,
} from 'react';
import TextareaAutosize from 'react-textarea-autosize';

function focusAtEnd(element: HTMLTextAreaElement | null) {
  element?.focus();
  element?.setSelectionRange(element.value.length, element.value.length);
}

function EditMessage({
  initial,
  onCancel,
  onSubmit,
}: {
  initial: string;
  onCancel: () => void;
  onSubmit: ((content: string) => void) | undefined;
}) {
  const [value, setValue] = useState(initial);
  const touch = useMediaQuery('(pointer: coarse)');

  const content = value.trim();

  const send = () => {
    if (content && onSubmit) {
      onSubmit(content);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      onCancel();
    }

    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing &&
      !touch
    ) {
      event.preventDefault();
      send();
    }
  };

  return (
    <form
      aria-label='Edit message'
      className='flex w-full flex-col gap-2 rounded-2xl bg-muted p-3'
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <TextareaAutosize
        aria-label='Message'
        className='resize-none bg-transparent px-1 text-base leading-relaxed outline-none'
        maxRows={12}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
        ref={focusAtEnd}
        value={value}
      />
      <div className='flex justify-end gap-2'>
        <Button onClick={onCancel} size='sm' type='button' variant='ghost'>
          Cancel
        </Button>
        <Button disabled={!content || !onSubmit} size='sm' type='submit'>
          Send
        </Button>
      </div>
    </form>
  );
}

function VersionLink({
  children,
  id,
  label,
}: {
  children: ReactNode;
  id: number | undefined;
  label: string;
}) {
  if (id === undefined) {
    return (
      <Button aria-label={label} disabled size='icon-xs' variant='ghost'>
        {children}
      </Button>
    );
  }

  return (
    <Button asChild size='icon-xs' variant='ghost'>
      <Link aria-label={label} params={{ id }} to='/c/$id'>
        {children}
      </Link>
    </Button>
  );
}

export function VersionSwitcher({ chats, index }: Versions) {
  return (
    <nav
      aria-label='Versions'
      className='flex items-center gap-0.5 text-xs text-muted-foreground tabular-nums'
    >
      <VersionLink id={chats[index - 1]} label='Previous version'>
        <ChevronLeft aria-hidden='true' />
      </VersionLink>
      <span>
        {index + 1} / {chats.length}
      </span>
      <VersionLink id={chats[index + 1]} label='Next version'>
        <ChevronRight aria-hidden='true' />
      </VersionLink>
    </nav>
  );
}

function AttachedFile({ name, uploadId }: BubbleFile) {
  if (!uploadId) {
    return <FileChip name={name} />;
  }

  if (name.toLowerCase().endsWith('.pdf')) {
    return <DocumentCard name={name} uploadId={uploadId} />;
  }

  return <FileChip href={uploadUrl(uploadId)} name={name} />;
}

export function UserMessage({
  bubble,
  editable = false,
  onEdit,
  versions,
}: {
  bubble: UserBubble;
  editable?: boolean;
  onEdit?: (content: string) => void;
  versions?: ReactNode;
}) {
  const [editing, setEditing] = useState(false);

  const cancelled = useRef(false);

  const editButton = useCallback((node: HTMLButtonElement | null) => {
    if (node && cancelled.current) {
      cancelled.current = false;
      node.focus();
    }
  }, []);

  return (
    <Message align='end'>
      <MessageContent>
        {(bubble.images?.length ?? 0) > 0 && (
          <div className='flex flex-wrap justify-end gap-2'>
            {bubble.images?.map((source, index) => (
              <ImageCard
                key={index}
                className='max-h-48'
                name='Image'
                src={source}
              />
            ))}
          </div>
        )}
        {(bubble.files?.length ?? 0) > 0 && (
          <div className='flex flex-wrap justify-end gap-2'>
            {bubble.files?.map((attached, index) => (
              <AttachedFile key={index} {...attached} />
            ))}
          </div>
        )}
        {editing && (
          <EditMessage
            initial={bubble.text}
            onCancel={() => {
              cancelled.current = true;
              setEditing(false);
            }}
            onSubmit={onEdit}
          />
        )}
        {!editing && bubble.text && (
          <Bubble align='end' variant='muted'>
            <BubbleContent className='rounded-2xl px-4 text-base whitespace-pre-wrap'>
              {bubble.text}
            </BubbleContent>
          </Bubble>
        )}
        {!editing && (editable || versions) && (
          <MessageFooter className='min-h-8 gap-0.5 px-0'>
            {onEdit && (
              <div className='hover-reveal group-hover/message:opacity-100'>
                <IconButton
                  label='Edit'
                  onClick={() => setEditing(true)}
                  ref={editButton}
                >
                  <Pencil aria-hidden='true' className='size-4' />
                </IconButton>
              </div>
            )}
            {versions}
          </MessageFooter>
        )}
      </MessageContent>
    </Message>
  );
}

export function QueuedMessage({
  bubble,
  onCancel,
}: {
  bubble: UserBubble;
  onCancel: () => void;
}) {
  return (
    <div className='flex items-center justify-end gap-1 opacity-60'>
      <Button
        aria-label='Cancel queued message'
        className='text-muted-foreground'
        onClick={onCancel}
        size='icon-xs'
        variant='ghost'
      >
        <X aria-hidden='true' />
      </Button>
      <UserMessage bubble={bubble} />
    </div>
  );
}
