import { ChatHeader } from '@/components/chat-header';
import { Composer, type ComposerControl } from '@/components/composer';
import { Conversation } from '@/components/conversation';
import { EmptyConversation } from '@/components/empty-conversation';
import { ErrorNotice } from '@/components/error-notice';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useChatSession } from '@/hooks/use-chat-session';
import { useComposer } from '@/hooks/use-composer';
import type { PendingSubmission } from '@/lib/chat-session';
import { LoaderCircle, WifiOff } from 'lucide-react';
import type { ComponentProps } from 'react';

type Props = {
  sessionId: string;
  header: Omit<ComponentProps<typeof ChatHeader>, 'title' | 'children'>;
};

type ChatSessionState = ReturnType<typeof useChatSession>;

export function ChatSession({ sessionId, header }: Props) {
  const { data } = useAuth();
  const chat = useChatSession(sessionId);
  const draft = useComposer(`${data!.user.id}:${sessionId}`);

  const snapshot = chat.snapshot.data;
  const error = chat.accessError || chat.snapshot.error;

  if (!snapshot || chat.accessError) {
    return (
      <>
        <ChatHeader {...header} title='New chat' />
        <main className='flex flex-1 items-center justify-center p-6'>
          {error ? (
            <div className='w-full max-w-md'>
              <ErrorNotice
                error={error}
                onRetry={chat.reconnect}
              />
            </div>
          ) : (
            <div
              role='status'
              className='flex items-center gap-2 text-sm text-muted-foreground'
            >
              <LoaderCircle className='size-4 motion-safe:animate-spin' />
              Loading conversation…
            </div>
          )}
        </main>
      </>
    );
  }

  const readOnly = snapshot.metadata.role === 'viewer';
  const control = composerControl(chat, readOnly);

  async function retrySending() {
    const text = chat.pending?.text;
    const previousDraft = draft.text;

    const accepted = await chat.retrySending();

    if (
      accepted &&
      previousDraft.trim() === text &&
      draft.textarea.current?.value === previousDraft
    ) {
      draft.setText('');
    }

    return accepted;
  }

  function editMessage() {
    const text = chat.recoverRejected();

    if (text === null) {
      return;
    }

    if (!draft.text) {
      draft.setText(text);
    }

    draft.textarea.current?.focus();
  }

  const notice = chat.pending
    ? pendingNotice(chat.pending, {
        readOnly,
        retry: retrySending,
        edit: editMessage,
        refresh: chat.reconnect,
      })
    : null;

  return (
    <>
      <ChatHeader {...header} title={snapshot.metadata.title || 'New chat'}>
        {readOnly && (
          <span className='rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground'>
            View only
          </span>
        )}
      </ChatHeader>
      <main className='flex min-h-0 flex-1 flex-col'>
        {chat.messages.length ? (
          <Conversation
            messages={chat.messages}
            active={chat.activity !== 'idle'}
          />
        ) : (
          <div className='mx-auto flex w-full max-w-3xl flex-1 items-center overflow-y-auto px-5 py-8 sm:px-8'>
            <EmptyConversation />
          </div>
        )}
        <div className='mx-auto w-full max-w-3xl shrink-0 px-4 pt-2 pb-4 sm:px-8 sm:pb-5'>
          <ConnectionNotice chat={chat} />
          {notice && chat.activity !== 'submitting' && (
            <div
              role='status'
              className='mb-3 flex items-center justify-between gap-3 px-1 text-xs text-muted-foreground'
            >
              <span>{notice.message}</span>
              <Button variant='ghost' size='xs' onClick={notice.onClick}>
                {notice.label}
              </Button>
            </div>
          )}
          <Composer draft={draft} onSend={chat.send} {...control} />
        </div>
      </main>
    </>
  );
}

function pendingNotice(
  pending: PendingSubmission,
  actions: {
    readOnly: boolean;
    retry: () => Promise<boolean>;
    edit: () => void;
    refresh: () => void;
  }
) {
  switch (pending.state) {
    case 'rejected':
      return {
        message: 'Your message wasn’t sent.',
        label: 'Edit message',
        onClick: actions.edit,
      };
    case 'uncertain':
      return {
        message: 'Your last message hasn’t been confirmed.',
        label: actions.readOnly ? 'Refresh' : 'Retry sending',
        onClick: actions.readOnly ? actions.refresh : actions.retry,
      };
  }
}

function composerControl(
  chat: ChatSessionState,
  readOnly: boolean
): ComposerControl {
  if (readOnly) {
    return { mode: 'read-only' };
  }

  switch (chat.activity) {
    case 'running':
    case 'stopping':
      return { mode: chat.activity, onStop: chat.stop };
    case 'submitting':
      return { mode: 'submitting' };
    case 'idle':
      if (chat.pending || chat.snapshot.isError) {
        return { mode: 'disabled' };
      }

      return { mode: 'ready' };
  }
}

function ConnectionNotice({ chat }: { chat: ChatSessionState }) {
  const error =
    chat.connection.status === 'disconnected'
      ? chat.connection.error
      : chat.snapshot.error;

  if (error) {
    return (
      <div className='mb-3'>
        <ErrorNotice
          error={error}
          onRetry={chat.reconnect}
          retryLabel='Reconnect'
        />
      </div>
    );
  }

  if (chat.connection.status !== 'reconnecting') {
    return null;
  }

  return (
    <div
      role='status'
      className='mb-3 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground'
    >
      <WifiOff className='size-3.5' />
      <span className='flex-1'>
        Reconnecting. Your work continues in the background.
      </span>
      <Button variant='ghost' size='xs' onClick={chat.reconnect}>
        Reconnect
      </Button>
    </div>
  );
}
