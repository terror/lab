import { useEffect, useState } from 'react';

export const presence = {
  bands: { leave: 60_000, summary: 10_000, verb: 2_000 },
  drift: 2_000,
  slow: 20_000,
  stall: 3_000,
} as const;

type Band = 'leave' | 'mark' | 'summary' | 'verb';

type Pose = 'pondering' | 'waiting' | 'working' | 'writing';

type Events = {
  quiet: number;
  tool: boolean;
  waiting: boolean;
  writing: boolean;
};

export type Presence = {
  band: Band;
  elapsed: number;
  pose: Pose;
  slow: boolean;
  stall: number;
};

export type Clock = { at: number; start: number; waited: number };

const DRIFT_STEP_MS = 100;

const SECOND = 1_000;

function bandFor(elapsed: number): Band {
  if (elapsed < presence.bands.verb) {
    return 'mark';
  }

  if (elapsed < presence.bands.summary) {
    return 'verb';
  }

  return elapsed < presence.bands.leave ? 'summary' : 'leave';
}

function poseFor({ tool, waiting, writing }: Events): Pose {
  if (waiting) {
    return 'waiting';
  }

  if (writing) {
    return 'writing';
  }

  return tool ? 'working' : 'pondering';
}

export function presenceFor(elapsed: number, events: Events): Presence {
  const pose = poseFor(events);

  const silent = pose === 'pondering' || pose === 'writing' ? events.quiet : 0;

  const drifted = Math.min(
    1,
    Math.max(0, silent - presence.stall) / presence.drift
  );

  return {
    band: bandFor(elapsed),
    elapsed,
    pose,
    slow: silent >= presence.slow,
    stall: 1 - (1 - drifted) ** 2,
  };
}

function untilNext(now: number, { at, start, waited }: Clock) {
  const quiet = now - at;

  const second =
    SECOND - ((((now - start - waited) % SECOND) + SECOND) % SECOND);

  const drifting =
    quiet >= presence.stall && quiet < presence.stall + presence.drift;

  const marks = [presence.stall, presence.slow]
    .map((mark) => mark - quiet)
    .filter((wait) => wait > 0);

  return Math.min(second, ...marks, ...(drifting ? [DRIFT_STEP_MS] : []));
}

export function usePresence(
  clock: Clock | undefined,
  events: Omit<Events, 'quiet'>
): Presence {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!clock) {
      return undefined;
    }

    let timer: number;

    const arm = () => {
      timer = window.setTimeout(
        () => {
          setNow(Date.now());
          arm();
        },
        untilNext(Date.now(), clock)
      );
    };

    arm();

    return () => window.clearTimeout(timer);
  }, [clock]);

  if (!clock) {
    return {
      ...presenceFor(presence.bands.verb, { ...events, quiet: 0 }),
      elapsed: 0,
    };
  }

  const current = Math.max(now, clock.at);

  return presenceFor(Math.max(0, current - clock.start - clock.waited), {
    ...events,
    quiet: current - clock.at,
  });
}
