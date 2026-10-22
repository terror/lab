import { Composer } from '@/components/composer';
import { EmptyConversation } from '@/components/empty-conversation';
import { useAuth } from '@/hooks/use-auth';
import { useComposer } from '@/hooks/use-composer';
import { useCreateSession } from '@/hooks/use-sessions';
import { chatSubmissionOptions } from '@/lib/chat-session';
import { useQueryScope } from '@/providers/query-provider';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

export function NewChat({
  workspaceId,
  onCreated,
}: {
  workspaceId: string;
  onCreated: (sessionId: string) => void;
}) {
  const { data } = useAuth();
  const user = data!.user;
  const client = useQueryClient();
  const { signal } = useQueryScope();
  const submission = useMutation(chatSubmissionOptions(client, signal));
  const draft = useComposer(`${user.id}:${workspaceId}:new`);
  const creation = useCreateSession(workspaceId);
  const creating = useRef(false);

  async function send(text: string) {
    if (creating.current || signal.aborted) {
      return false;
    }

    creating.current = true;

    try {
      const { sessionId } = await creation.mutateAsync(text);

      if (signal.aborted) {
        return false;
      }

      submission.mutate({ sessionId, text, requestId: crypto.randomUUID() });
      onCreated(sessionId);
      return true;
    } catch {
      return false;
    } finally {
      creating.current = false;
    }
  }

  return (
    <main className='flex min-h-0 flex-1 flex-col overflow-y-auto'>
      <div className='mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 pt-8 pb-10 sm:px-8 sm:pb-16'>
        <EmptyConversation />
        <div className='mt-8 sm:mt-10'>
          <Composer
            draft={draft}
            onSend={send}
            mode={creation.isPending ? 'submitting' : 'ready'}
          />
        </div>
      </div>
    </main>
  );
}
