import { StartComposer } from '@/components/start-composer';
import { Suggestions } from '@/components/suggestions';
import { LiveMark } from '@/components/ui/live-mark';
import { UnreadChips } from '@/components/unread-chips';
import { useDraft } from '@/lib/conversations';
import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';

const greetedKey = 'lab:greeted';

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

function useFirstVisit() {
  const [first] = useState(
    () => window.sessionStorage.getItem(greetedKey) === null
  );

  useEffect(() => {
    window.sessionStorage.setItem(greetedKey, 'true');
  }, []);

  return first;
}

export function NewChat({ user }: { user: { name: string } }) {
  const first = useFirstVisit();
  const [, setDraft] = useDraft('new');
  const input = useRef<HTMLTextAreaElement>(null);

  const prompt = (text: string) => {
    setDraft(text);
    input.current?.focus();
    input.current?.setSelectionRange(text.length, text.length);
  };

  return (
    <div className='flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 pb-24'>
      <div className='flex w-full max-w-3xl flex-col items-center gap-8'>
        <div
          className={cn(
            'flex flex-col items-center gap-4 text-center',
            first && 'animate-in duration-story fade-in slide-in-from-bottom-2'
          )}
        >
          <LiveMark className='size-10' state={first ? 'assemble' : 'idle'} />
          <h1 className='text-3xl font-semibold tracking-tight text-balance sm:text-4xl'>
            {greeting(user.name)}
          </h1>
        </div>
        <div className='relative w-full'>
          <StartComposer draft='new' inputRef={input} />
          <div className='absolute inset-x-0 top-full mt-4 flex flex-col items-center gap-2'>
            <UnreadChips />
            <Suggestions onPrompt={prompt} />
          </div>
        </div>
      </div>
    </div>
  );
}
