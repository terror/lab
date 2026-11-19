import { preferencesQueryOptions } from '@/lib/preferences';
import { renderHookWithQuery, stubFetch } from '@/test/helpers';
import { defaultPreferences } from '@lab/server/schemas';
import { QueryClient } from '@tanstack/react-query';
import { act } from 'react';
import { expect, test, vi } from 'vitest';

import { useCurrentNote, useHint, useNote } from './hints';

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
    const { result } = await renderHookWithQuery(() => {
      useNote('foo', true);

      return [
        useHint('bar', true).show,
        useHint('baz', false).show,
        useHint('qux', true).show,
        useCurrentNote()?.id,
      ];
    }, client);

    const quiet = result.current;

    await act(() =>
      client.setQueryData(preferencesQueryOptions.queryKey, {
        ...preferences,
        personality: 'default',
      })
    );

    await vi.waitFor(() => expect(result.current[3]).toBe('foo'));

    const shown = result.current;

    await act(() => vi.advanceTimersByTime(12_000));

    expect({ after: result.current, quiet, saved, shown }).toEqual({
      after: [false, false, false, undefined],
      quiet: [false, false, false, undefined],
      saved: [{ hints: ['bar', 'foo'] }],
      shown: [false, false, false, 'foo'],
    });
  } finally {
    vi.useRealTimers();
  }
});
