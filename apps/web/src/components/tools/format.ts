import { type ToolView } from './types';

export const day = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
});

const sizeUnits = ['B', 'KB', 'MB', 'GB'] as const;

const sizeNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

export function formatBytes(size: number) {
  const power = Math.min(
    sizeUnits.length - 1,
    Math.floor(Math.log10(Math.max(size, 1)) / 3)
  );

  return `${sizeNumber.format(size / 1000 ** power)} ${sizeUnits[power]}`;
}

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

export function plural(amount: number, noun: string) {
  return `${amount} ${noun}${amount === 1 ? '' : 's'}`;
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
