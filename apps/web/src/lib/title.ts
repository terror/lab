import { markShapes } from '@/components/lab-mark';
import { useQuery } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';
import { useEffect, useState } from 'react';

import { client } from './client';
import { unreadChatsQueryOptions } from './conversations';
import { usePageHidden } from './media';

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

  return undefined;
}

function icon(color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><mask id="m"><rect width="32" height="32" fill="#fff"/><rect x="18" width="14" height="14"/></mask><g mask="url(#m)"><path d="${markShapes.coral}" fill="#f09082"/><path d="${markShapes.blue}" fill="#4d9abf"/><path d="${markShapes.yellow}" fill="#f1be58"/></g><rect x="20" width="12" height="12" fill="${color}"/></svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function useTabSignal() {
  const hidden = usePageHidden();
  const [before, setBefore] = useState<Seen>();

  const { data } = useQuery({
    ...unreadChatsQueryOptions,
    enabled: hidden,
    refetchIntervalInBackground: true,
  });

  if (hidden && data && !before) {
    setBefore(seen(data));
  }

  if (!hidden && before) {
    setBefore(undefined);
  }

  return before && data && arrived(before, data);
}

export function useDocumentTitle(title: string) {
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

    if (!link || !signal) {
      return undefined;
    }

    link.href = icon(signals[signal].color);

    return () => {
      link.href = ICON;
    };
  }, [signal]);
}
