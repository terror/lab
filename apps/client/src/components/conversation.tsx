import { CopyButton } from '@/components/copy-button';
import { Markdown } from '@/components/markdown';
import { ToolCall } from '@/components/tool-call';
import { Button } from '@/components/ui/button';
import { useAutoScroll } from '@/hooks/use-auto-scroll';
import { messageText } from '@/lib/chat-projection';
import type {
  ChatAssistantMessage,
  ChatMessage,
  ChatPart,
  ChatResponseState,
} from '@lab/shared';
import { ArrowDown, CircleAlert, LoaderCircle } from 'lucide-react';
import type { ReactElement } from 'react';

export function Conversation({
  messages,
  active,
}: {
  messages: ChatMessage[];
  active: boolean;
}) {
  const scroll = useAutoScroll();

  return (
    <div className='relative min-h-0 flex-1'>
      <div
        ref={scroll.container}
        onScroll={scroll.onScroll}
        className='h-full overflow-y-auto overscroll-contain'
        aria-label='Conversation'
      >
        <div
          ref={scroll.content}
          className='mx-auto w-full max-w-3xl space-y-8 px-5 pt-7 pb-10 sm:px-8'
        >
          {messages.map((message) => (
            <ConversationMessage key={message.id} message={message} />
          ))}
          {active && messages.at(-1)?.role !== 'assistant' && (
            <Progress>Thinking…</Progress>
          )}
        </div>
      </div>
      {scroll.showScrollButton && (
        <Button
          variant='outline'
          size='icon'
          className='absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-background shadow-sm'
          aria-label='Scroll to latest message'
          onClick={scroll.scrollToBottom}
        >
          <ArrowDown />
        </Button>
      )}
    </div>
  );
}

function ConversationMessage({
  message,
}: {
  message: ChatMessage;
}): ReactElement {
  switch (message.role) {
    case 'user':
      return (
        <div className='flex justify-end'>
          <div className='max-w-[88%] rounded-[1.25rem] rounded-tr-md bg-muted px-5 py-3.5 text-[15px] leading-7 break-words whitespace-pre-wrap'>
            {message.text}
          </div>
        </div>
      );
    case 'assistant':
      return <AssistantMessage message={message} />;
  }
}

function AssistantMessage({ message }: { message: ChatAssistantMessage }) {
  const text = messageText(message);

  const active =
    message.state.status === 'running' || message.state.status === 'retrying';

  return (
    <section aria-label='Lab response' className='min-w-0'>
      <div className='min-w-0 flex-1 pt-0.5'>
        <div className='space-y-4'>
          {message.parts.map((part) => (
            <MessagePart key={part.id} part={part} />
          ))}
        </div>
        <ResponseStatus
          state={message.state}
          hasParts={!!message.parts.length}
        />
        {!active && text && (
          <div className='mt-3 -ml-1'>
            <CopyButton text={text} />
          </div>
        )}
      </div>
    </section>
  );
}

function MessagePart({ part }: { part: ChatPart }): ReactElement | null {
  switch (part.type) {
    case 'text':
      return part.text ? <Markdown>{part.text}</Markdown> : null;
    case 'tool':
      return <ToolCall part={part} />;
  }
}

function ResponseStatus({
  state,
  hasParts,
}: {
  state: ChatResponseState;
  hasParts: boolean;
}): ReactElement | null {
  switch (state.status) {
    case 'running':
      return <Progress>{hasParts ? 'Working…' : 'Thinking…'}</Progress>;
    case 'retrying':
      return <Progress>Retrying response…</Progress>;
    case 'stopped':
      return (
        <p className='mt-3 text-xs text-muted-foreground'>Response stopped</p>
      );
    case 'error':
      return (
        <p className='mt-3 flex items-start gap-2 text-sm text-destructive'>
          <CircleAlert className='mt-0.5 size-4 shrink-0' />
          {state.message}
        </p>
      );
    case 'complete':
      return null;
  }
}

function Progress({ children }: { children: string }) {
  return (
    <div
      role='status'
      className='mt-3 flex items-center gap-2 py-1 text-xs text-muted-foreground'
    >
      <LoaderCircle className='size-3.5 motion-safe:animate-spin' />
      {children}
    </div>
  );
}
