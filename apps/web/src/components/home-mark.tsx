import { LiveMark } from '@/components/ui/live-mark';
import { useDraft, useUnreadChats } from '@/lib/conversations';
import { maxFeatures, spring } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { useQuiet } from '@/lib/voice';
import {
  LazyMotion,
  animate,
  m,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  useVelocity,
} from 'motion/react';
import { useEffect, useRef, useState } from 'react';

const DOZE_MS = 360_000;

const LEAN_MS = 1_600;

const LEASH = 52;

const SHAKES = 5;

const SHAKE_MS = 1_600;

const fizzedKey = 'lab:fizzed';

function leash(offset: number) {
  return LEASH * Math.tanh(offset / LEASH);
}

function release(reversals: readonly number[]) {
  const now = performance.now();

  const shaken = reversals.filter((at) => now - at < SHAKE_MS).length >= SHAKES;

  if (!shaken || window.sessionStorage.getItem(fizzedKey) !== null) {
    return 'bubble';
  }

  window.sessionStorage.setItem(fizzedKey, 'true');

  return 'fizz';
}

const poses = {
  leaning: { scaleX: 1.06, scaleY: 0.94, y: 1.875 },
  upright: { scaleX: 1, scaleY: 1, y: 0 },
};

const signs = ['pointermove', 'keydown', 'input'];

function onActivity(listener: () => void) {
  for (const sign of signs) {
    window.addEventListener(sign, listener);
  }

  return () => {
    for (const sign of signs) {
      window.removeEventListener(sign, listener);
    }
  };
}

function useLean(draft: string) {
  const [seen, setSeen] = useState(draft);
  const [changes, setChanges] = useState(0);

  if (seen !== draft) {
    setSeen(draft);
    setChanges(changes + 1);
  }

  useEffect(() => {
    if (changes === 0) {
      return undefined;
    }

    const timer = window.setTimeout(() => setChanges(0), LEAN_MS);

    return () => window.clearTimeout(timer);
  }, [changes]);

  return changes > 0;
}

function useDoze(enabled: boolean) {
  const [pose, setPose] = useState<'doze' | 'idle' | 'wake'>('idle');

  const dozing = pose === 'doze';

  if (dozing && !enabled) {
    setPose('wake');
  }

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    if (dozing) {
      return onActivity(() => setPose('wake'));
    }

    let timer = window.setTimeout(() => setPose('doze'), DOZE_MS);

    const stop = onActivity(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setPose('doze'), DOZE_MS);
    });

    return () => {
      window.clearTimeout(timer);
      stop();
    };
  }, [dozing, enabled]);

  return pose;
}

export function HomeMark({ assemble }: { assemble: boolean }) {
  const quiet = useQuiet();
  const reduced = useReducedMotion();
  const unread = useUnreadChats();
  const [draft] = useDraft('new');

  const waiting = unread.data?.waiting ?? [];

  const busy = (unread.data?.running ?? 0) + waiting.length > 0;

  const lively = !quiet && !reduced && !busy;

  const leaning = useLean(draft) && lively;

  const pose = useDoze(lively);

  const states = {
    doze: 'doze',
    idle: assemble ? 'assemble' : 'idle',
    wake: 'wake',
  } as const;

  const playful = !quiet && !reduced;

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const leashX = useTransform(x, leash);
  const leashY = useTransform(y, leash);
  const tilt = useSpring(
    useTransform(useVelocity(x), [-300, 300], [-16, 16]),
    spring.snap
  );
  const shake = useRef({ direction: 0, reversals: [] as number[] });
  const [toy, setToy] = useState<'bubble' | 'fizz' | 'held'>();
  const [posed, setPosed] = useState(pose);

  if (posed !== pose) {
    setPosed(pose);
    setToy(undefined);
  }

  return (
    <LazyMotion features={maxFeatures()}>
      <m.span
        _dragX={x}
        _dragY={y}
        className={cn(
          'flex select-none',
          playful && 'cursor-grab touch-none active:cursor-grabbing'
        )}
        drag={playful}
        dragMomentum={false}
        onDrag={(_, { delta }) => {
          const direction = Math.abs(delta.x) > 0.8 ? Math.sign(delta.x) : 0;

          if (direction === 0 || direction === shake.current.direction) {
            return;
          }

          if (shake.current.direction !== 0) {
            shake.current.reversals.push(performance.now());
          }

          shake.current.direction = direction;
        }}
        onDragEnd={() => {
          void animate(x, 0, spring.pop);
          void animate(y, 0, spring.pop);
          setToy(release(shake.current.reversals));
        }}
        onDragStart={() => {
          shake.current = { direction: 0, reversals: [] };
          setToy('held');
        }}
        style={{ originY: 0.9, rotate: tilt, x: leashX, y: leashY }}
      >
        <m.span
          animate={leaning ? poses.leaning : poses.upright}
          className='flex origin-bottom'
          transition={spring.lively}
        >
          <LiveMark className='size-10' state={toy ?? states[pose]} />
        </m.span>
      </m.span>
    </LazyMotion>
  );
}
