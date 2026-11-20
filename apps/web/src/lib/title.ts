import { markShapes } from '@/components/lab-mark';
import { useQuery } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { client } from './client';
import { unreadChatsQueryOptions } from './conversations';
import { useMoment } from './moment';
import { SIDE, sigil } from './sigil';

type Unread = InferResponseType<typeof client.conversations.unread.$get, 200>;

type Seen = { finished: Set<string>; waiting: Set<number> };

const signals = {
  done: { color: '#f1be58', prefix: 'Done · ' },
  needsYou: { color: '#f09082', prefix: 'Needs you · ' },
};

type Signal = keyof typeof signals;

const ICON = '/favicon.svg';

function finished({ chats }: Unread) {
  return chats.map(({ finishedAt, id }) => `${id} ${finishedAt}`);
}

function seen(unread: Unread): Seen {
  return {
    finished: new Set(finished(unread)),
    waiting: new Set(unread.waiting.map(({ id }) => id)),
  };
}

function arrived(before: Seen, unread: Unread): Signal | undefined {
  if (unread.waiting.some(({ id }) => !before.waiting.has(id))) {
    return 'needsYou';
  }

  if (finished(unread).some((key) => !before.finished.has(key))) {
    return 'done';
  }

  return unread.waiting.length > 0 ? 'needsYou' : undefined;
}

const mark = `<path d="${markShapes.coral}" fill="#f09082"/><path d="${markShapes.blue}" fill="#4d9abf"/><path d="${markShapes.yellow}" fill="#f1be58"/>`;

const CELL = 6;

function face(seed: AppSeed | undefined) {
  if (!seed) {
    return mark;
  }

  const cells = sigil(seed)
    .flat()
    .map(
      (cell) =>
        `<rect x="${1 + (cell % SIDE) * CELL}" y="${1 + Math.floor(cell / SIDE) * CELL}" width="${CELL}" height="${CELL}"/>`
    )
    .join('');

  return `<style>.s{fill:#0a0a0a}@media (prefers-color-scheme:dark){.s{fill:#fafafa}}</style><g class="s">${cells}</g>`;
}

function icon(seed: AppSeed | undefined, color: string | undefined) {
  const open = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">';

  if (!color) {
    return `data:image/svg+xml,${encodeURIComponent(`${open}${face(seed)}</svg>`)}`;
  }

  const svg = `${open}<mask id="m"><rect width="32" height="32" fill="#fff"/><rect x="18" width="14" height="14"/></mask><g mask="url(#m)">${face(seed)}</g><rect x="20" width="12" height="12" fill="${color}"/></svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function subscribe(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange);

  return () => document.removeEventListener('visibilitychange', onChange);
}

function useTabSignal() {
  const allowed = useMoment('tab.signal').on;
  const hidden = useSyncExternalStore(subscribe, () => document.hidden);
  const [before, setBefore] = useState<Seen>();

  const { data } = useQuery({
    ...unreadChatsQueryOptions,
    enabled: hidden,
    refetchInterval: ({ state }) => (state.data?.runs?.length ? 2_000 : 60_000),
    refetchIntervalInBackground: true,
  });

  if (hidden && data && !before) {
    setBefore(seen(data));
  }

  if (!hidden && before) {
    setBefore(undefined);
  }

  return allowed && before && data && arrived(before, data);
}

type AppSeed = `app:${string}:${string}`;

export function useDocumentTitle(title: string, seed?: AppSeed) {
  const signal = useTabSignal();

  const shown = signal ? signals[signal].prefix + title : title;

  useEffect(() => {
    document.title = shown;

    return () => {
      document.title = 'Lab';
    };
  }, [shown]);

  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel=icon]');

    if (!link || (!signal && !seed)) {
      return undefined;
    }

    link.href = icon(seed, signal ? signals[signal].color : undefined);

    return () => {
      link.href = ICON;
    };
  }, [seed, signal]);
}
