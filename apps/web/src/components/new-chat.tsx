import { StartComposer } from '@/components/start-composer';
import { Suggestions } from '@/components/suggestions';
import { LiveMark } from '@/components/ui/live-mark';
import { UnreadChips } from '@/components/unread-chips';
import { startChatKey, useDraft, useLatestChats } from '@/lib/conversations';
import { holdGlide } from '@/lib/glide';
import { stagger } from '@/lib/motion';
import { readStored, writeStored } from '@/lib/storage';
import { cn } from '@/lib/utils';
import { say, useQuiet } from '@/lib/voice';
import { useIsMutating } from '@tanstack/react-query';
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { z } from 'zod';

const greetedKey = 'lab:greeted';

const DAY = 86_400_000;

const visitSchema = z.object({ absent: z.number(), at: z.number() });

function storedVisit() {
  try {
    return visitSchema.safeParse(
      JSON.parse(window.sessionStorage.getItem(greetedKey) ?? 'null')
    ).data;
  } catch {
    return undefined;
  }
}

function useVisit() {
  const [visit] = useState(() => {
    const stored = storedVisit();

    if (stored) {
      return { ...stored, first: false };
    }

    const at = Date.now();

    return {
      absent: (at - readStored('last-seen', z.number(), at)) / DAY,
      at,
      first: true,
    };
  });

  useEffect(() => {
    window.sessionStorage.setItem(
      greetedKey,
      JSON.stringify({ absent: visit.absent, at: visit.at })
    );
    writeStored('last-seen', Date.now());
  }, [visit]);

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

export function NewChat({ user }: { user: { id: string; name: string } }) {
  const { absent, at, first } = useVisit();
  const quiet = useQuiet();
  const chats = useLatestChats();
  const fresh = chats.data?.length === 0;
  const greeting = say(
    'greeting',
    { absent, at: new Date(at), fresh, name: user.name },
    { quiet, seed: `${user.id}:${new Date(at).toDateString()}` }
  );
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
          <LiveMark
            className='size-10'
            state={first && !quiet ? 'assemble' : 'idle'}
          />
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
