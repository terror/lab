import { confetti } from '@/lib/confetti';
import { preferencesQueryOptions } from '@/lib/preferences';
import { setStorageUser } from '@/lib/storage';
import { renderHookWithQuery, renderWithQuery } from '@/test/helpers';
import { defaultPreferences } from '@lab/server/schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, act } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import { useMoment } from './moment';

vi.mock('@/lib/confetti', () => ({ confetti: vi.fn() }));

afterEach(() => {
  vi.useRealTimers();
});

function preferring(personality: 'default' | 'quiet') {
  const client = new QueryClient();

  client.setQueryData(preferencesQueryOptions.queryKey, {
    ...defaultPreferences,
    personality,
  });

  return client;
}

function ledger(area: Storage) {
  return JSON.parse(area.getItem('lab:foo:moments') ?? '{}') as Record<
    string,
    number[]
  >;
}

const anchor = { current: document.body };

test('plan confetti plays once for each plan and three times a day', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 18, 9));

  let plan = { subject: 'foo', when: false };

  const { rerender } = await renderHookWithQuery(
    () => useMoment('plan.complete', { anchor, ...plan }),
    preferring('default')
  );

  const complete = async (subject: string) => {
    plan = { subject, when: false };

    await rerender();

    plan = { subject, when: true };

    await rerender();

    return vi.mocked(confetti).mock.calls.length;
  };

  const bursts = [];

  for (const subject of ['foo', 'bar', 'baz', 'qux', 'foo']) {
    bursts.push(await complete(subject));
  }

  vi.setSystemTime(new Date(2026, 10, 19, 9));

  for (const subject of ['foo', 'qux']) {
    bursts.push(await complete(subject));
  }

  expect({
    bursts,
    from: vi.mocked(confetti).mock.calls.map(([element]) => element),
    kept: Object.fromEntries(
      Object.entries(ledger(window.localStorage)).map(([key, stamps]) => [
        key,
        stamps.length,
      ])
    ),
  }).toEqual({
    bursts: [1, 2, 3, 3, 3, 3, 4],
    from: [document.body, document.body, document.body, document.body],
    kept: {
      'plan.complete': 1,
      'plan.complete/bar': 1,
      'plan.complete/baz': 1,
      'plan.complete/foo': 1,
      'plan.complete/qux': 1,
    },
  });
});

test('a session budget belongs to one user in one tab until midnight', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 18, 23));

  const { result } = await renderHookWithQuery(
    () => useMoment('home.fizz'),
    preferring('default')
  );

  const plays: boolean[] = [];

  const play = async () => plays.push(await act(() => result.current.play()));

  await play();
  await play();

  setStorageUser('bar');

  await play();

  setStorageUser('foo');

  await play();

  vi.setSystemTime(new Date(2026, 10, 19, 0));

  await play();

  expect(plays).toEqual([true, false, true, false, true]);
});

function Row({ finished }: { finished: boolean }) {
  const { mark, order } = useMoment('row.handoff', { when: finished });

  return <output>{mark ? order : 'dot'}</output>;
}

function rows(finished: boolean) {
  return [1, 2, 3, 4, 5, 6, 7, 8].map((id) => (
    <Row key={id} finished={finished} />
  ));
}

test('a burst plays six at once in order, and each holds for its duration and its place', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

  const { screen } = await renderWithQuery(rows(false), preferring('default'));

  const shown = () =>
    [...screen.container.querySelectorAll('output')].map(
      ({ textContent }) => textContent
    );

  const seen = [shown()];

  await screen.rerender(rows(true));

  seen.push(shown());

  await act(() => vi.advanceTimersByTime(949));

  seen.push(shown());

  await act(() => vi.advanceTimersByTime(31));

  seen.push(shown());

  expect(seen).toEqual([
    ['dot', 'dot', 'dot', 'dot', 'dot', 'dot', 'dot', 'dot'],
    ['0', '1', '2', '3', '4', '5', 'dot', 'dot'],
    ['0', '1', '2', '3', '4', '5', 'dot', 'dot'],
    ['dot', 'dot', '2', '3', '4', '5', 'dot', 'dot'],
  ]);
});

test('a condition that holds at mount is no event, and each subject is counted on its own', async () => {
  let ask = { subject: 'foo', when: true };

  const { rerender, result } = await renderHookWithQuery(
    () => useMoment('ask.ahem', ask),
    preferring('default')
  );

  const marks = [result.current.mark];

  for (const subject of ['foo', 'foo', 'bar']) {
    ask = { subject, when: false };

    await rerender();

    ask = { subject, when: true };

    await rerender();

    marks.push(result.current.mark);
  }

  expect(marks).toEqual([undefined, 'ahem', undefined, 'ahem']);
});

test('a moment asked for under Quiet never plays, even once Quiet is off', async () => {
  const client = preferring('quiet');

  const { rerender, result } = await renderHookWithQuery(
    () => useMoment('home.fizz'),
    client
  );

  const played = await act(() => result.current.play());

  client.setQueryData(preferencesQueryOptions.queryKey, defaultPreferences);

  await rerender();

  expect({
    kept: ledger(window.sessionStorage),
    on: result.current.on,
    played,
  }).toEqual({ kept: {}, on: false, played: false });
});

function hide() {
  const visibility = vi
    .spyOn(document, 'visibilityState', 'get')
    .mockReturnValue('hidden');

  return async (visible: boolean) => {
    visibility.mockReturnValue(visible ? 'visible' : 'hidden');

    await act(() => document.dispatchEvent(new Event('visibilitychange')));
  };
}

test('a moment that waits for a hidden tab spends once it is seen, and is dropped if its host goes first', async () => {
  const show = hide();

  const seen = [];

  for (const [subject, leave] of [
    ['foo', false],
    ['bar', true],
  ] as const) {
    let when = false;

    const { rerender, result, unmount } = await renderHookWithQuery(
      () => useMoment('plan.complete', { anchor, subject, when }),
      preferring('default')
    );

    when = true;

    await rerender();

    const waiting = result.current.on;

    if (leave) {
      await unmount();
    }

    await show(true);

    seen.push({
      bursts: vi.mocked(confetti).mock.calls.length,
      kept: Object.keys(ledger(window.localStorage)).toSorted(),
      waiting,
    });

    await show(false);
  }

  expect(seen).toEqual([
    {
      bursts: 1,
      kept: ['plan.complete', 'plan.complete/foo'],
      waiting: false,
    },
    {
      bursts: 1,
      kept: ['plan.complete', 'plan.complete/foo'],
      waiting: false,
    },
  ]);
});

test('a moment that doesn’t wait is skipped in a hidden tab and never plays for that cue', async () => {
  const show = hide();

  let when = false;

  const { rerender, result } = await renderHookWithQuery(
    () => useMoment('rail.done', { when }),
    preferring('default')
  );

  when = true;

  await rerender();

  const marks = [result.current.mark];

  await show(true);

  marks.push(result.current.mark);

  when = false;

  await rerender();

  when = true;

  await rerender();

  marks.push(result.current.mark);

  expect(marks).toEqual([undefined, undefined, 'done']);
});

test('a moment goes off when its subject goes away', async () => {
  let subject: string | undefined = 'foo';

  const { rerender, result } = await renderHookWithQuery(
    () => useMoment('empty.enter', { subject }),
    preferring('default')
  );

  const on = [result.current.on];

  subject = undefined;

  await rerender();

  on.push(result.current.on);

  expect(on).toEqual([true, false]);
});

function Arrival() {
  return <output>{String(useMoment('home.arrive').on)}</output>;
}

test('a moment cued by its mount spends once when effects run twice', async () => {
  const screen = await render(
    <StrictMode>
      <QueryClientProvider client={preferring('default')}>
        <Arrival />
      </QueryClientProvider>
    </StrictMode>
  );

  expect({
    kept: ledger(window.sessionStorage)['home.arrive']?.length,
    on: screen.container.textContent,
  }).toEqual({ kept: 1, on: 'true' });
});
