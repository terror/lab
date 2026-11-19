import { preferencesQueryOptions } from '@/lib/preferences';
import { renderHookWithQuery, stubFetch } from '@/test/helpers';
import { defaultPreferences } from '@lab/server/schemas';
import { QueryClient } from '@tanstack/react-query';
import { act } from 'react';
import { expect, test, vi } from 'vitest';

import { useCurrentNote, useHint, useNote } from './hints';

function useScene() {
  useNote('foo', true);

  return [
    useHint('bar', true).show,
    useHint('baz', false).show,
    useHint('qux', true).show,
    useCurrentNote()?.id,
  ];
}

test('one hint a session, each once for the account, and none when quiet', async () => {
  const client = new QueryClient();

  const preferences = {
    ...defaultPreferences,
    hints: ['bar'],
    personality: 'quiet' as const,
  };

  client.setQueryData(preferencesQueryOptions.queryKey, preferences);

  const saved: unknown[] = [];

  stubFetch((_, init) => {
    if (typeof init?.body === 'string') {
      saved.push(JSON.parse(init.body));
    }

    return Response.json({
      preferences: client.getQueryData(preferencesQueryOptions.queryKey),
    });
  });

  vi.useFakeTimers();

  try {
    const { result, unmount } = await renderHookWithQuery(useScene, client);

    const quiet = result.current;

    await act(() =>
      client.setQueryData(preferencesQueryOptions.queryKey, {
        ...preferences,
        personality: 'default',
      })
    );

    await vi.waitFor(() => expect(result.current[3]).toBe('foo'));

    const shown = result.current;

    await act(() => vi.advanceTimersByTime(11_000));

    await unmount();

    const again = await renderHookWithQuery(useScene, client);

    const remounted = again.result.current;

    await act(() => vi.advanceTimersByTime(1_000));

    expect({
      after: again.result.current,
      quiet,
      remounted,
      saved,
      shown,
    }).toEqual({
      after: [false, false, false, undefined],
      remounted: [false, false, false, 'foo'],
      quiet: [false, false, false, undefined],
      saved: [{ hints: ['bar', 'foo'] }],
      shown: [false, false, false, 'foo'],
    });
  } finally {
    vi.useRealTimers();
  }
});
