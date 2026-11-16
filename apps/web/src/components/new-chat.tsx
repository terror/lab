import { Composer } from '@/components/composer';
import { LabMark } from '@/components/lab-mark';
import { Button } from '@/components/ui/button';
import {
  conversationsQueryOptions,
  createConversation,
} from '@/lib/conversations';
import { modelsQueryOptions } from '@/lib/models';
import { selectConversation } from '@/lib/route';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type LucideIcon,
  ChefHat,
  Lightbulb,
  PenLine,
  Plane,
} from 'lucide-react';
import { useRef, useState } from 'react';

const suggestions: { icon: LucideIcon; label: string; prompt: string }[] = [
  { icon: Plane, label: 'Plan a trip', prompt: 'Help me plan a trip to ' },
  { icon: PenLine, label: 'Write something', prompt: 'Help me write ' },
  { icon: Lightbulb, label: 'Explain a topic', prompt: 'Explain ' },
  {
    icon: ChefHat,
    label: 'Cook dinner',
    prompt: 'Suggest a dinner recipe using ',
  },
];

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
  const [model, setModel] = useState<string>();
  const textarea = useRef<HTMLTextAreaElement>(null);

  const selectedModel = model ?? models.data?.[0]?.id;

  const create = useMutation({
    mutationFn: (content: string) => createConversation(content, selectedModel),
    onSuccess: async (id) => {
      selectConversation(id);
      await queryClient.invalidateQueries(conversationsQueryOptions);
    },
  });

  const suggest = (prompt: string) => {
    setDraft(prompt);
    textarea.current?.focus();
  };

  return (
    <div className='flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 pb-[12vh]'>
      <div className='flex w-full max-w-3xl flex-col items-center gap-8'>
        <div className='flex animate-in flex-col items-center gap-4 text-center duration-500 fade-in slide-in-from-bottom-2'>
          <LabMark className='size-10' />
          <h1 className='text-3xl font-semibold tracking-tight text-balance sm:text-4xl'>
            {greeting(user.name)}
          </h1>
          <p className='text-muted-foreground'>
            What can Lab help you with today?
          </p>
        </div>
        <Composer
          draft={draft}
          error={create.error?.message}
          model={selectedModel}
          onDraftChange={setDraft}
          onModelChange={setModel}
          onSubmit={(content) => create.mutate(content)}
          submitting={create.isPending}
          textareaRef={textarea}
        />
        <div className='flex flex-wrap justify-center gap-2'>
          {suggestions.map(({ icon: Icon, label, prompt }) => (
            <Button
              key={label}
              className='rounded-full text-muted-foreground'
              onClick={() => suggest(prompt)}
              size='sm'
              type='button'
              variant='outline'
            >
              <Icon aria-hidden='true' />
              {label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
