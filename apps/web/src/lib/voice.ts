import { useEffect, useState } from 'react';

import { usePreference } from './preferences';

export type Moment = { absent: number; at: Date; name: string };

type Voice = {
  greeting: Moment;
  thinking: number;
};

type Lines<T> = {
  plain: (context: T) => string;
  pool: (context: T) => readonly string[];
};

function firstName(name: string) {
  return name.split(' ')[0] || name;
}

function plainGreeting({ at, name }: Moment) {
  const hour = at.getHours();
  const first = firstName(name);

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

const weekdays = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const greetings: {
  lines: (first: string, at: Date) => readonly string[];
  when: (moment: Moment) => boolean;
}[] = [
  {
    lines: (first) => [
      `Happy new year, ${first}`,
      `New year, ${first}. Clean notebook.`,
      `First day of the year, ${first}. Something small?`,
    ],
    when: ({ at }) => at.getMonth() === 0 && at.getDate() === 1,
  },
  {
    lines: (first) => [
      `Welcome back, ${first}`,
      `There you are, ${first}. Everything is where you left it.`,
      `Long time, ${first}. The bench is clean.`,
    ],
    when: ({ absent }) => absent >= 14,
  },
  {
    lines: (first) => [
      `Good morning, ${first}`,
      `Monday, ${first}. Fresh notebook.`,
      `New week, ${first}. What’s first?`,
    ],
    when: ({ at }) =>
      at.getDay() === 1 && at.getHours() >= 5 && at.getHours() < 12,
  },
  {
    lines: (first) => [
      `Good evening, ${first}`,
      `Friday night, ${first}. One last experiment?`,
      `It’s Friday, ${first}. Something small?`,
    ],
    when: ({ at }) => at.getDay() === 5 && at.getHours() >= 17,
  },
  {
    lines: (first, at) => [
      `Good morning, ${first}`,
      `No rush today, ${first}.`,
      `Slow ${weekdays[at.getDay()]}, ${first}?`,
    ],
    when: ({ at }) =>
      (at.getDay() === 0 || at.getDay() === 6) &&
      at.getHours() >= 5 &&
      at.getHours() < 12,
  },
  {
    lines: (first) => [
      `Up late, ${first}?`,
      `Still here, ${first}? So is the bench light.`,
      `Night shift, ${first}.`,
    ],
    when: ({ at }) => at.getHours() < 5,
  },
  {
    lines: (first) => [
      `Good morning, ${first}`,
      `Morning, ${first}. What are we working on?`,
      `Morning, ${first}. The bench is set.`,
    ],
    when: ({ at }) => at.getHours() < 12,
  },
  {
    lines: (first) => [
      `Good afternoon, ${first}`,
      `Afternoon, ${first}. What are we working on?`,
      `Hello, ${first}. Pull up a stool.`,
    ],
    when: ({ at }) => at.getHours() < 18,
  },
  {
    lines: (first) => [
      `Good evening, ${first}`,
      `Evening, ${first}. What’s on the bench?`,
      `Evening, ${first}. One more experiment?`,
    ],
    when: () => true,
  },
];

const waits = [
  ['Thinking'],
  ['Stirring it in', 'Turning it over', 'Letting it settle'],
  ['Still on it'],
  ['You can leave this, I’ll mark it when it’s done'],
];

const waitAfter = [4_000, 20_000, 90_000];

const voice: { [K in keyof Voice]: Lines<Voice[K]> } = {
  greeting: {
    plain: plainGreeting,
    pool: (moment) =>
      greetings
        .find(({ when }) => when(moment))
        ?.lines(firstName(moment.name), moment.at) ?? [plainGreeting(moment)],
  },
  thinking: {
    plain: () => 'Thinking',
    pool: (tier) => waits[tier] ?? ['Thinking'],
  },
};

function hash(seed: string) {
  let value = 2_166_136_261;

  for (let index = 0; index < seed.length; index++) {
    value = Math.imul(value ^ seed.charCodeAt(index), 16_777_619);
  }

  return value >>> 0;
}

export function say<K extends keyof Voice>(
  key: K,
  context: Voice[K],
  { quiet, seed }: { quiet: boolean; seed: string }
) {
  const lines: Lines<Voice[K]> = voice[key];

  if (quiet) {
    return lines.plain(context);
  }

  const pool = lines.pool(context);

  return pool[hash(`${key}:${seed}`) % pool.length] ?? lines.plain(context);
}

export function useQuiet() {
  const [personality] = usePreference('personality');

  return personality === 'quiet';
}

export function useThinking(turn: string | undefined) {
  const quiet = useQuiet();
  const [reached, setReached] = useState<{ tier: number; turn?: string }>({
    tier: 0,
  });

  useEffect(() => {
    if (turn === undefined) {
      return undefined;
    }

    const timers = waitAfter.map((after, index) =>
      setTimeout(() => setReached({ tier: index + 1, turn }), after)
    );

    return () => {
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  }, [turn]);

  return say('thinking', reached.turn === turn ? reached.tier : 0, {
    quiet,
    seed: turn ?? '',
  });
}
