import type {
  AssistantResult,
  SessionMessage,
  SessionView,
} from '@lab/app-protocol';
import { useEffect, useRef } from 'react';

import { ToolActivity } from './tool-activity';

const roles = {
  user: 'You',
  assistant: 'Agent',
} satisfies Record<SessionMessage['role'], string>;

function MessageResult({ result }: { result: AssistantResult }) {
  switch (result.status) {
    case 'complete':
      return null;

    case 'interrupted':
      return (
        <p className='text-xs text-muted-foreground'>Response interrupted</p>
      );

    case 'failed':
      return <p className='text-sm text-destructive'>{result.error}</p>;

    default:
      return result satisfies never;
  }
}

export function SessionTranscript({ view }: { view: SessionView }) {
  const transcript = useRef<HTMLDivElement>(null);

  const following = useRef(true);

  useEffect(() => {
    if (following.current && transcript.current) {
      transcript.current.scrollTop = transcript.current.scrollHeight;
    }
  });

  return (
    <div
      ref={transcript}
      className='min-h-0 flex-1 overflow-y-auto px-6 py-8'
      onScroll={() => {
        const element = transcript.current;

        if (element) {
          following.current =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            80;
        }
      }}
    >
      <section aria-label='Conversation' className='space-y-8'>
        {view.messages.length === 0 && view.status === 'idle' && (
          <div className='py-12 text-center'>
            <h2 className='text-xl font-semibold'>
              What would you like to work on?
            </h2>

            <p className='mt-2 text-sm text-muted-foreground'>
              Send a message to start this session.
            </p>
          </div>
        )}

        {view.messages.map((message) => (
          <article key={message.id} className='space-y-2'>
            <h2 className='text-sm font-medium text-muted-foreground'>
              {roles[message.role]}
            </h2>

            {message.text && (
              <p className='text-sm leading-7 break-words whitespace-pre-wrap'>
                {message.text}
              </p>
            )}

            {message.role === 'assistant' && (
              <MessageResult result={message.result} />
            )}
          </article>
        ))}

        {view.partial && (
          <article className='space-y-2'>
            <h2 className='text-sm font-medium text-muted-foreground'>Agent</h2>

            <p className='text-sm leading-7 break-words whitespace-pre-wrap'>
              {view.partial}
            </p>
          </article>
        )}

        {view.status === 'unanswered' && (
          <p role='status' className='text-sm text-muted-foreground'>
            The agent finished without a response. You can send another message.
          </p>
        )}
      </section>

      <ToolActivity tools={view.tools} />
    </div>
  );
}
