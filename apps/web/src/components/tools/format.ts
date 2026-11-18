import { plural } from '@/lib/format';

import { type ToolView } from './types';

export function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function field(value: unknown, key: string) {
  return typeof value === 'object' && value !== null && key in value
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

export function count(value: unknown) {
  return typeof value === 'number' ? value : undefined;
}

export function quoted(value: unknown) {
  const content = text(value);

  return content ? ` for “${content}”` : '';
}

export function parse(args: string) {
  try {
    const value: unknown = JSON.parse(args);

    return typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function pathTitle(running: string, done: string) {
  return ({ active, args }: ToolView) => {
    const target = text(args.path);

    if (active) {
      return running;
    }

    return target ? `${done} ${target}` : done;
  };
}

export function declined(title: (view: ToolView) => string, refused: string) {
  return (view: ToolView) =>
    text(field(field(view.details, 'approval'), 'decision')) === 'denied'
      ? refused
      : title(view);
}

export function namedTitle(
  name: (view: ToolView) => unknown,
  {
    named = (value) => `“${value}”`,
    unnamed,
  }: { named?: (value: string) => string; unnamed?: string } = {}
) {
  return (running: string, done: string) => (view: ToolView) => {
    const value = text(name(view));

    if (view.active) {
      return running;
    }

    if (value) {
      return `${done} ${named(value)}`;
    }

    return unnamed ? `${done} ${unnamed}` : running;
  };
}

const bases: Record<string, string> = {
  Adding: 'add',
  Asking: 'ask',
  Building: 'build',
  Changing: 'change',
  Checking: 'check',
  Copying: 'copy',
  Creating: 'create',
  Delegating: 'delegate',
  Deleting: 'delete',
  Editing: 'edit',
  Finding: 'find',
  Forgetting: 'forget',
  Listing: 'list',
  Moving: 'move',
  Pinning: 'pin',
  Reading: 'read',
  Remembering: 'remember',
  Removing: 'remove',
  Renaming: 'rename',
  Restoring: 'restore',
  Running: 'run',
  Saving: 'save',
  Scheduling: 'schedule',
  Searching: 'search',
  Updating: 'update',
  Using: 'use',
  Writing: 'write',
};

export function failedTitle(active: string) {
  const [verb = '', ...rest] = active.split(' ');

  const base = bases[verb];

  return base ? `Couldn’t ${[base, ...rest].join(' ')}` : `${active} failed`;
}

export function seconds(value: unknown) {
  const ms = count(value);

  return ms === undefined ? undefined : `${(ms / 1_000).toFixed(1)}s`;
}

export function readRange(details: unknown) {
  const start = count(field(details, 'start'));
  const end = count(field(details, 'end'));
  const total = count(field(details, 'total'));

  if (start === undefined || end === undefined || total === undefined) {
    return undefined;
  }

  if (start === 0 && end === total) {
    return plural(total, 'character');
  }

  return `characters ${start}–${end} of ${total}`;
}
