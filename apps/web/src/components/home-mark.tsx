import { LiveMark } from '@/components/ui/live-mark';
import { useDraft, useUnreadChats } from '@/lib/conversations';
import { spring } from '@/lib/motion';
import { useQuiet } from '@/lib/voice';
import { m, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';

const DOZE_MS = 360_000;

const LEAN_MS = 1_600;

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

  return (
    <m.span
      animate={leaning ? poses.leaning : poses.upright}
      className='flex origin-bottom'
      transition={spring.lively}
    >
      <LiveMark className='size-10' state={states[pose]} />
    </m.span>
  );
}
