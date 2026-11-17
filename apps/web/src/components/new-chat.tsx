import { Composer } from '@/components/composer';
import { LabMark } from '@/components/lab-mark';
import { UnreadChips } from '@/components/unread-chips';
import type { Attachment } from '@/lib/attachments';
import {
  conversationsQueryKey,
  createConversation,
  useDraft,
} from '@/lib/conversations';
import { useChatModel } from '@/lib/models';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

function greeting(name: string) {
  const hour = new Date().getHours();
  const first = name.split(' ')[0] || name;

  if (hour < 5) {
    return `Up late, ${first}?`;
  }

  if (hour < 12) {
    return `Good morning, ${first}`;
  }

  if (hour < 18) {
    return `Good afternoon, ${first}`;
  }

  return `Good evening, ${first}`;
}

export function NewChat({ user }: { user: { name: string } }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [draft, setDraft] = useDraft('new');
  const [selectedModel, setModel] = useChatModel();
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const create = useMutation({
    meta: { inlineError: true },
    mutationFn: (content: string) =>
      createConversation(content, attachments, selectedModel),
    onSuccess: async (id, content) => {
      if (draft.trim() === content) {
        setDraft('');
      }

      await navigate({ params: { id }, to: '/c/$id' });
      await queryClient.invalidateQueries({ queryKey: conversationsQueryKey });
    },
  });

  return (
    <div className='flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 pb-24'>
      <div className='flex w-full max-w-3xl flex-col items-center gap-8'>
        <div className='flex animate-in flex-col items-center gap-4 text-center duration-500 fade-in slide-in-from-bottom-2'>
          <LabMark className='size-10' />
          <h1 className='text-3xl font-semibold tracking-tight text-balance sm:text-4xl'>
            {greeting(user.name)}
          </h1>
        </div>
        <div className='relative w-full'>
          <Composer
            attachments={attachments}
            draft={draft}
            error={create.error?.message}
            model={selectedModel}
            onAttachmentsChange={setAttachments}
            onDraftChange={(value) => {
              if (create.isError) {
                create.reset();
              }

              setDraft(value);
            }}
            onModelChange={setModel}
            onSubmit={(content) => create.mutate(content)}
            submitting={create.isPending}
          />
          <UnreadChips />
        </div>
      </div>
    </div>
  );
}
