import { Composer } from '@/components/composer';
import { LabMark } from '@/components/lab-mark';
import {
  conversationsQueryOptions,
  createConversation,
} from '@/lib/conversations';
import { type ModelChoice, modelsQueryOptions } from '@/lib/models';
import { selectConversation } from '@/lib/route';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  const models = useQuery(modelsQueryOptions);

  const [draft, setDraft] = useState('');
  const [model, setModel] = useState<ModelChoice>();

  const fallback = models.data?.[0];

  const selectedModel =
    model ?? (fallback === undefined ? undefined : { id: fallback.id });

  const create = useMutation({
    mutationFn: (content: string) => createConversation(content, selectedModel),
    onSuccess: async (id) => {
      selectConversation(id);
      await queryClient.invalidateQueries(conversationsQueryOptions);
    },
  });

  return (
    <div className='flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 pb-[12vh]'>
      <div className='flex w-full max-w-3xl flex-col items-center gap-8'>
        <div className='flex animate-in flex-col items-center gap-4 text-center duration-500 fade-in slide-in-from-bottom-2'>
          <LabMark className='size-10' />
          <h1 className='text-3xl font-semibold tracking-tight text-balance sm:text-4xl'>
            {greeting(user.name)}
          </h1>
        </div>
        <Composer
          draft={draft}
          error={create.error?.message}
          model={selectedModel}
          onDraftChange={setDraft}
          onModelChange={setModel}
          onSubmit={(content) => create.mutate(content)}
          submitting={create.isPending}
        />
      </div>
    </div>
  );
}
