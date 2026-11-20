import { preferencesQueryOptions } from '@/lib/preferences';
import { renderHookWithQuery, stubFetch } from '@/test/helpers';
import { defaultPreferences } from '@lab/server/schemas';
import { QueryClient } from '@tanstack/react-query';
import { act } from 'react';
import { expect, test, vi } from 'vitest';

import { useCurrentNote, useHint, useNote } from './hints';

function useScene(eligible = true) {
  useNote('baz', eligible);
  useNote('foo', eligible);

  return [
    useHint('bar', true).show,
    useHint('qux', true).show,
    useCurrentNote()?.id,
  ];
}

test('a hint shows once the account confirms it is new, one a session', async () => {
  const client = new QueryClient();

  const server = {
    ...defaultPreferences,
    hints: ['bar', 'baz'],
  };

  client.setQueryData(preferencesQueryOptions.queryKey, {
    ...server,
    hints: ['bar'],
  });

  const claimed: unknown[] = [];

  stubFetch((_, init) => {
    if (typeof init?.body !== 'string') {
      return Response.json({ preferences: server });
    }

    const { id } = JSON.parse(init.body);

    const fresh = !server.hints.includes(id);

    claimed.push([id, fresh]);

    server.hints = fresh ? [...server.hints, id] : server.hints;

    return Response.json({ fresh, preferences: server });
  });

  vi.useFakeTimers();

  try {
    const { result, unmount } = await renderHookWithQuery(
      () => useScene(),
      client
    );

    await vi.waitFor(() => expect(result.current[2]).toBe('foo'));

    const shown = result.current;

    await act(() => vi.advanceTimersByTime(11_000));

    await unmount();

    const elsewhere = await renderHookWithQuery(() => useScene(false), client);

    const ineligible = elsewhere.result.current;

    await elsewhere.unmount();

    const again = await renderHookWithQuery(() => useScene(), client);

    const remounted = again.result.current;

    await act(() => vi.advanceTimersByTime(1_000));

    expect({
      after: again.result.current,
      claimed,
      ineligible,
      remounted,
      shown,
    }).toEqual({
      after: [false, false, undefined],
      claimed: [
        ['baz', false],
        ['foo', true],
      ],
      ineligible: [false, false, undefined],
      remounted: [false, false, 'foo'],
      shown: [false, false, 'foo'],
    });
  } finally {
    vi.useRealTimers();
  }
});
