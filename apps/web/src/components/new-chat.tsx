import { Bench, focusItem } from '@/components/bench';
import { HomeMark } from '@/components/home-mark';
import { PickUp, Prompts, useShelf } from '@/components/shelf';
import { StartComposer } from '@/components/start-composer';
import { Brief, BriefToken } from '@/components/ui/brief';
import { HomeFrame } from '@/components/ui/home-frame';
import { useBlank } from '@/lib/capabilities';
import { startChatKey, useDraft, useUnreadChats } from '@/lib/conversations';
import { holdGlide } from '@/lib/glide';
import { stagger } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { type BriefKind, brief, say, useQuiet } from '@/lib/voice';
import { useIsMutating } from '@tanstack/react-query';
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';
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

function select(input: HTMLTextAreaElement | null, text: string) {
  const at = text.indexOf('…');
  const [start, end] = at === -1 ? [text.length, text.length] : [at, at + 1];

  input?.focus();
  input?.setSelectionRange(start, end);
}

function oneLine(text: string, input: HTMLTextAreaElement | null) {
  const context = document.createElement('canvas').getContext('2d');

  if (!input || !context) {
    return text;
  }

  const style = getComputedStyle(input);

  context.font = style.font;

  const room =
    input.clientWidth -
    Number.parseFloat(style.paddingLeft) -
    Number.parseFloat(style.paddingRight) -
    1;

  const fits = (line: string) => context.measureText(line).width <= room;

  if (fits(text)) {
    return text;
  }

  const words = text.split(' ');

  while (words.length > 1 && !fits(`${words.join(' ')}…`)) {
    words.pop();
  }

  return `${words.join(' ')}…`;
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
  const shelf = useShelf();
  const unread = useUnreadChats();
  const greeting = say('greeting', undefined, {
    quiet,
    seed: `${user.id}:${new Date(at).toDateString()}`,
  });
  const hello = shelf.fresh && !quiet;
  const fade = hello || (first && !quiet);
  const [draft, setDraft] = useDraft('new');
  const [preview, setPreview] = useState<string>();
  const [expanded, setExpanded] = useState(false);
  const [lit, setLit] = useState<BriefKind>();
  const input = useRef<HTMLTextAreaElement>(null);
  const composer = useRef<HTMLDivElement>(null);
  const below = useRef<HTMLDivElement>(null);
  const starting = useIsMutating({ mutationKey: startChatKey }) > 0;

  useBlank(
    useCallback(() => select(input.current, input.current?.value ?? ''), [])
  );

  useLayoutEffect(() => {
    const top = composer.current?.getBoundingClientRect().top;

    if (!starting || top === undefined) {
      return undefined;
    }

    return holdGlide(top);
  }, [starting]);

  const counts = {
    finished: unread.data?.chats.length ?? 0,
    needs: unread.data?.waiting.length ?? 0,
    running: unread.data?.running ?? 0,
  };

  const news = counts.finished + counts.needs + counts.running > 0;

  const waiting =
    shelf.loading || !(unread.isFetched || unread.failureCount > 0);

  const pending = waiting || !shelf.ready;

  const prompt = (text: string) => {
    flushSync(() => {
      setDraft(text);
      setPreview(undefined);
    });

    select(input.current, text);
  };

  const show = (text: string | undefined) =>
    setPreview(text && oneLine(text, input.current));

  const item = (kind: BriefKind) =>
    below.current?.querySelector<HTMLElement>(`[data-kind=${kind}]`);

  const jump = (kind: BriefKind) => {
    if (!item(kind)) {
      flushSync(() => setExpanded(true));
    }

    focusItem(item(kind));
  };

  return (
    <HomeFrame
      above={
        <div
          key={String(waiting)}
          className={cn(
            'flex flex-col items-center gap-4',
            waiting && 'invisible',
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
          {news && (
            <Brief still={quiet}>
              {brief(counts, quiet).map((part, index) =>
                part.kind === undefined ? (
                  <Fragment key={index}>{part.text}</Fragment>
                ) : (
                  <BriefToken
                    key={part.kind}
                    attention={part.kind === 'needs'}
                    count={part.count}
                    onBlur={() => setLit(undefined)}
                    onClick={() => jump(part.kind)}
                    onFocus={() => setLit(part.kind)}
                    onPointerEnter={() => setLit(part.kind)}
                    onPointerLeave={() => setLit(undefined)}
                  >
                    {part.text}
                  </BriefToken>
                )
              )}
            </Brief>
          )}
        </div>
      }
      below={
        !pending && (
          <div
            ref={below}
            className={cn(
              'flex animate-in flex-col gap-6 pt-5 duration-base fade-in',
              starting && 'opacity-0 transition-opacity duration-fast ease-in'
            )}
          >
            {shelf.fresh ? (
              <>
                <p className='rounded-card border border-dashed px-4 py-3.5 text-sm text-muted-foreground'>
                  Finished work and questions for you will show up here.
                </p>
                <Prompts
                  hidden={draft !== ''}
                  label='Try'
                  lines={shelf.starters ?? []}
                  onPreview={show}
                  onPrompt={prompt}
                />
              </>
            ) : (
              <>
                <Bench
                  expanded={expanded}
                  lit={lit}
                  onExpand={() => setExpanded(true)}
                />
                <PickUp {...shelf} />
                {!news && (
                  <Prompts
                    hidden={draft !== ''}
                    label='Try'
                    lines={shelf.tries}
                    onPreview={show}
                    onPrompt={prompt}
                  />
                )}
              </>
            )}
          </div>
        )
      }
    >
      <div ref={composer}>
        <StartComposer draft='new' inputRef={input} placeholder={preview} />
      </div>
    </HomeFrame>
  );
}
