import { HomeMark } from '@/components/home-mark';
import { StartComposer } from '@/components/start-composer';
import { HomeFrame } from '@/components/ui/home-frame';
import { useBlank } from '@/lib/capabilities';
import { startChatKey } from '@/lib/conversations';
import { holdGlide } from '@/lib/glide';
import { useMoment } from '@/lib/moment';
import { stagger } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { say } from '@/lib/voice';
import { useIsMutating } from '@tanstack/react-query';
import {
  Fragment,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

function select(input: HTMLTextAreaElement | null) {
  const text = input?.value ?? '';
  const at = text.indexOf('…');
  const [start, end] = at === -1 ? [text.length, text.length] : [at, at + 1];

  input?.focus();
  input?.setSelectionRange(start, end);
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
  const first = useMoment('home.arrive').on;
  const voiced = useMoment('home.prompt').on;
  const [day] = useState(() => new Date().toDateString());
  const greeting = say('greeting', undefined, {
    quiet: !voiced,
    seed: `${user.id}:${day}`,
  });
  const fade = first && voiced;
  const input = useRef<HTMLTextAreaElement>(null);
  const composer = useRef<HTMLDivElement>(null);
  const starting = useIsMutating({ mutationKey: startChatKey }) > 0;

  useBlank(useCallback(() => select(input.current), []));

  useLayoutEffect(() => {
    const top = composer.current?.getBoundingClientRect().top;

    if (!starting || top === undefined) {
      return undefined;
    }

    return holdGlide(top);
  }, [starting]);

  return (
    <HomeFrame
      above={
        <div
          className={cn(
            'flex flex-col items-center gap-4',
            first && 'animate-in duration-story fade-in slide-in-from-bottom-2',
            starting &&
              'opacity-0 transition duration-fast ease-in motion-safe:-translate-y-2'
          )}
        >
          <HomeMark assemble={fade} />
          <h1 className='text-3xl font-semibold tracking-tight text-balance sm:text-4xl'>
            {fade ? <Words text={greeting} /> : greeting}
          </h1>
        </div>
      }
    >
      <div ref={composer}>
        <StartComposer background draft='new' inputRef={input} />
      </div>
    </HomeFrame>
  );
}
