import { HomeMark } from '@/components/home-mark';
import { StartComposer } from '@/components/start-composer';
import { Suggestions } from '@/components/suggestions';
import { UnreadChips } from '@/components/unread-chips';
import { startChatKey, useDraft, useLatestChats } from '@/lib/conversations';
import { holdGlide } from '@/lib/glide';
import { stagger } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { say, useQuiet } from '@/lib/voice';
import { useIsMutating } from '@tanstack/react-query';
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { z } from 'zod';

const visitSchema = z.object({ at: z.number() });

function greetedKey(user: string) {
  return `lab:${user}:greeted`;
}

function storedVisit(user: string) {
  try {
    return visitSchema.safeParse(
      JSON.parse(window.sessionStorage.getItem(greetedKey(user)) ?? 'null')
    ).data;
  } catch {
    return undefined;
  }
}

function useVisit(user: string) {
  const [visit] = useState(() => {
    const stored = storedVisit(user);

    const at = Date.now();

    if (
      stored &&
      new Date(stored.at).toDateString() === new Date(at).toDateString()
    ) {
      return { ...stored, first: false };
    }

    return { at, first: true };
  });

  useEffect(() => {
    window.sessionStorage.setItem(
      greetedKey(user),
      JSON.stringify({ at: visit.at })
    );
  }, [user, visit]);

  return visit;
}

function Words({ text }: { text: string }) {
  return text.split(' ').map((word, index) => (
    <Fragment key={index}>
      {index > 0 && ' '}
      <span
        className='motion-safe:animate-word-in'
        style={{ animationDelay: `${Math.min(index, 5) * stagger}s` }}
      >
        {word}
      </span>
    </Fragment>
  ));
}

export function NewChat({ user }: { user: { id: string } }) {
  const { at, first } = useVisit(user.id);
  const quiet = useQuiet();
  const chats = useLatestChats();
  const fresh = chats.data?.length === 0;
  const greeting = say('greeting', undefined, {
    quiet,
    seed: `${user.id}:${new Date(at).toDateString()}`,
  });
  const hello = fresh && !quiet;
  const fade = hello || (first && !quiet);
  const [, setDraft] = useDraft('new');
  const input = useRef<HTMLTextAreaElement>(null);
  const composer = useRef<HTMLDivElement>(null);
  const starting = useIsMutating({ mutationKey: startChatKey }) > 0;

  useLayoutEffect(() => {
    const top = composer.current?.getBoundingClientRect().top;

    if (!starting || top === undefined) {
      return undefined;
    }

    return holdGlide(top);
  }, [starting]);

  const prompt = (text: string) => {
    setDraft(text);
    input.current?.focus();
    input.current?.setSelectionRange(text.length, text.length);
  };

  return (
    <div className='flex flex-1 flex-col items-center justify-center overflow-y-auto pb-24'>
      <div className='flex w-full max-w-3xl flex-col items-center gap-8 px-6'>
        <div
          key={String(chats.isPending)}
          className={cn(
            'flex flex-col items-center gap-4 text-center',
            chats.isPending && 'invisible',
            first && 'animate-in duration-story fade-in slide-in-from-bottom-2',
            starting &&
              'opacity-0 transition duration-fast ease-in motion-safe:-translate-y-2'
          )}
        >
          <HomeMark assemble={first && !quiet} />
          <h1 className='text-3xl font-semibold tracking-tight text-balance sm:text-4xl'>
            {fade ? <Words text={greeting} /> : greeting}
          </h1>
          {hello && (
            <p
              className='max-w-md text-balance text-muted-foreground motion-safe:animate-word-in'
              style={{ animationDelay: '240ms' }}
            >
              I’m Lab. I can read, write, run code and remember things. Start
              anywhere.
            </p>
          )}
        </div>
        <div ref={composer} className='relative w-full'>
          <StartComposer draft='new' inputRef={input} />
          <div
            className={cn(
              'absolute inset-x-0 top-full mt-4 flex flex-col items-center gap-2',
              starting && 'opacity-0 transition-opacity duration-fast ease-in'
            )}
          >
            <UnreadChips />
            <Suggestions onPrompt={prompt} />
          </div>
        </div>
      </div>
    </div>
  );
}
