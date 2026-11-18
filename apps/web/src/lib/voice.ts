import type { Pose } from '@/components/ui/empty-state';
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

type Copy = { description: string; title: string };

const empties = {
  active: {
    plain: {
      description: 'Describe one above and Lab will set it up.',
      title: 'No active tasks',
    },
    pose: 'asleep',
    voiced: {
      description: 'Describe a task above and Lab will run it on schedule.',
      title: 'Nothing on the clock',
    },
  },
  library: {
    plain: {
      description: 'Images and files from your chats land here.',
      title: 'Nothing on the shelves yet',
    },
    pose: 'default',
    voiced: {
      description: 'Images and files from your chats collect here.',
      title: 'Empty shelves',
    },
  },
  matches: {
    plain: {
      description: 'Nothing here matches that search and filter.',
      title: 'No matches',
    },
    pose: 'puzzled',
    voiced: {
      description: 'Try fewer words or another filter.',
      title: 'No matches',
    },
  },
  memory: {
    plain: {
      description:
        'Tell it something worth remembering in any chat, or add a memory here.',
      title: 'Lab hasn’t learned anything yet',
    },
    pose: 'default',
    voiced: {
      description:
        'Tell Lab something worth keeping in any chat, or add a memory here.',
      title: 'An empty jar',
    },
  },
  paused: {
    plain: {
      description: 'A task you pause waits here until you resume it.',
      title: 'No paused tasks',
    },
    pose: 'asleep',
    voiced: {
      description: 'A task you pause waits here until you resume it.',
      title: 'No paused tasks',
    },
  },
  project: {
    plain: {
      description: 'Start one above and it lands here.',
      title: 'No chats in this project yet',
    },
    pose: 'stretching',
    voiced: {
      description: 'Start a chat above and it lands here.',
      title: 'A fresh project',
    },
  },
  tasks: {
    plain: {
      description: 'Describe one above and Lab will set it up.',
      title: 'No scheduled tasks yet',
    },
    pose: 'asleep',
    voiced: {
      description: 'Describe a task above and Lab will run it on schedule.',
      title: 'Nothing on the clock',
    },
  },
  trash: {
    plain: {
      description: 'Chats and projects you delete land here.',
      title: 'All clean',
    },
    pose: 'drained',
    voiced: {
      description:
        'Chats and projects you delete wait here until you restore them or delete them for good.',
      title: 'Nothing to throw out',
    },
  },
} satisfies Record<string, { plain: Copy; pose: Pose; voiced: Copy }>;

export type EmptyView = keyof typeof empties;

export function useEmpty(view: EmptyView): Copy & { pose?: Pose } {
  const quiet = useQuiet();
  const { plain, pose, voiced } = empties[view];

  return quiet ? plain : { ...voiced, pose };
}
