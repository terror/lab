import { artifactCalls } from '@/lib/artifacts';
import { preferencesQueryOptions } from '@/lib/preferences';
import { renderHookWithQuery, stubFetch } from '@/test/helpers';
import { defaultPreferences } from '@lab/server/schemas';
import { QueryClient } from '@tanstack/react-query';
import { act } from 'react';
import { expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { useAppStatus } from './artifact-apps';

function save() {
  return artifactCalls(1, 'foo')(
    'store.set',
    { key: 'bar', value: 'baz' },
    false
  );
}

async function saveWith(hints: string[]) {
  const client = new QueryClient();

  const server = { ...defaultPreferences, hints };

  client.setQueryData(preferencesQueryOptions.queryKey, server);

  stubFetch((url) => {
    if (url.pathname === '/api/preferences/hints') {
      server.hints = [...server.hints, 'first-save'];

      return Response.json({ fresh: true, preferences: server });
    }

    if (url.pathname === '/api/preferences') {
      return Response.json({ preferences: server });
    }

    return new Response(null, { status: 204 });
  });

  const statuses: (string | undefined)[] = [];

  const { result } = await renderHookWithQuery(() => {
    const status = useAppStatus(1, 'foo');

    if (statuses.at(-1) !== status.status) {
      statuses.push(status.status);
    }

    return status;
  }, client);

  await save();

  return { result, statuses };
}

test('a save reads Saved once the account has saved before', async () => {
  const { result } = await saveWith(['first-save']);

  await expect
    .poll(() => result.current)
    .toEqual({
      asking: false,
      status: 'Saved',
    });
});

test('saves keep quiet until ten seconds pass without one after a Saved', async () => {
  vi.useFakeTimers();

  try {
    const { statuses } = await saveWith(['first-save']);

    await act(() => vi.advanceTimersByTime(1500));

    for (let step = 0; step < 3; step++) {
      await act(save);

      await act(() => vi.advanceTimersByTime(5000));
    }

    await act(() => vi.advanceTimersByTime(5000));

    await act(save);

    expect(statuses).toEqual(['Saved', undefined, 'Saved']);
  } finally {
    vi.useRealTimers();
  }
});

test('the first save on an account says it will be here next time, without a plain Saved first', async () => {
  await page.viewport(1280, 720);

  const { result, statuses } = await saveWith([]);

  await expect
    .poll(() => result.current)
    .toEqual({
      asking: false,
      status: 'Saved. It’ll be here next time.',
    });

  expect(statuses).toEqual(['Saved. It’ll be here next time.']);
});
