import type { Pose } from '@/components/ui/empty-state';

import { useMoment } from './moment';
import { usePreference } from './preferences';
import { hash } from './seed';

type Voice = {
  greeting: undefined;
  stall: undefined;
};

type Lines<T> = {
  plain: (context: T) => string;
  pool: (context: T) => readonly string[];
};

const voice: { [K in keyof Voice]: Lines<Voice[K]> } = {
  greeting: {
    plain: () => 'What are we working on?',
    pool: () => [
      'What are we working on?',
      'What would you like to make?',
      'What should we tackle next?',
      'What would you like to explore?',
      'Where should we start?',
      'What can I help with?',
    ],
  },
  stall: {
    plain: () => 'the model is slow right now',
    pool: () => ['still on it, the model is slow right now'],
  },
};

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

const briefKinds = ['finished', 'needs', 'running'] as const;

export type BriefKind = (typeof briefKinds)[number];

type BriefPart =
  | { count: number; kind: BriefKind; text: string }
  | { kind?: undefined; text: string };

const briefWords = {
  finished: {
    first: ['chat finished', 'chats finished'],
    later: ['finished', 'finished'],
    plain: ['finished', 'finished'],
  },
  needs: {
    first: ['chat needs you', 'chats need you'],
    later: ['needs you', 'need you'],
    plain: ['needs you', 'need you'],
  },
  running: {
    first: ['chat is running', 'chats are running'],
    later: ['is still running', 'are still running'],
    plain: ['running', 'running'],
  },
} as const;

function briefForm(quiet: boolean, index: number) {
  if (quiet) {
    return 'plain';
  }

  return index === 0 ? 'first' : 'later';
}

function briefJoin(quiet: boolean, kind: BriefKind) {
  if (quiet) {
    return ' · ';
  }

  return kind === 'running' ? '. ' : ' and ';
}

export function brief(counts: Record<BriefKind, number>, quiet: boolean) {
  const kinds = briefKinds.filter((kind) => counts[kind] > 0);

  const parts = kinds.flatMap((kind, index): BriefPart[] => {
    const count = counts[kind];

    const token = {
      count,
      kind,
      text: briefWords[kind][briefForm(quiet, index)][count === 1 ? 0 : 1],
    };

    return index === 0 ? [token] : [{ text: briefJoin(quiet, kind) }, token];
  });

  return quiet || parts.length === 0 ? parts : [...parts, { text: '.' }];
}

export function useQuiet() {
  const [personality] = usePreference('personality');

  return personality === 'quiet';
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
  const spoken = useMoment('empty.voice').on;
  const { plain, pose, voiced } = empties[view];

  return spoken ? { ...voiced, pose } : plain;
}
