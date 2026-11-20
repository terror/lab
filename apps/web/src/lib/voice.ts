import type { Pose } from '@/components/ui/empty-state';

import { hash } from './seed';

type Voice = {
  greeting: undefined;
  stall: undefined;
};

type Lines<T> = (context: T) => readonly [string, ...string[]];

const voice: { [K in keyof Voice]: Lines<Voice[K]> } = {
  greeting: () => [
    'What are we working on?',
    'What would you like to make?',
    'What should we tackle next?',
    'What would you like to explore?',
    'Where should we start?',
    'What can I help with?',
  ],
  stall: () => ['still on it, the model is slow right now'],
};

export function say<K extends keyof Voice>(
  key: K,
  context: Voice[K],
  seed: string
) {
  const lines: Lines<Voice[K]> = voice[key];

  const pool = lines(context);

  return pool[hash(`${key}:${seed}`) % pool.length] ?? pool[0];
}

type Copy = { description: string; title: string };

const empties = {
  active: {
    description: 'Describe a task above and Lab will run it on schedule.',
    pose: 'asleep',
    title: 'Nothing on the clock',
  },
  library: {
    description: 'Images and files from your chats collect here.',
    pose: 'default',
    title: 'Empty shelves',
  },
  matches: {
    description: 'Try fewer words or another filter.',
    pose: 'puzzled',
    title: 'No matches',
  },
  memory: {
    description:
      'Tell Lab something worth keeping in any chat, or add a memory here.',
    pose: 'default',
    title: 'An empty jar',
  },
  paused: {
    description: 'A task you pause waits here until you resume it.',
    pose: 'asleep',
    title: 'No paused tasks',
  },
  project: {
    description: 'Start a chat above and it lands here.',
    pose: 'stretching',
    title: 'A fresh project',
  },
  tasks: {
    description: 'Describe a task above and Lab will run it on schedule.',
    pose: 'asleep',
    title: 'Nothing on the clock',
  },
  trash: {
    description:
      'Chats and projects you delete wait here until you restore them or delete them for good.',
    pose: 'drained',
    title: 'Nothing to throw out',
  },
} satisfies Record<string, Copy & { pose: Pose }>;

export type EmptyView = keyof typeof empties;

export function emptyCopy(view: EmptyView): Copy & { pose: Pose } {
  return empties[view];
}
