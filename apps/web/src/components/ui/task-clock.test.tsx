import { preferencesQueryOptions } from '@/lib/preferences';
import { renderWithQuery } from '@/test/helpers';
import { defaultPreferences } from '@lab/server/schemas';
import { QueryClient } from '@tanstack/react-query';
import { expect, test } from 'vitest';

import { TaskClock } from './task-clock';

type Props = Parameters<typeof TaskClock>[0];

function client(personality: 'default' | 'quiet' = 'default') {
  const query = new QueryClient();

  query.setQueryData(preferencesQueryOptions.queryKey, {
    ...defaultPreferences,
    personality,
  });

  return query;
}

function transform(container: HTMLElement) {
  const line = container.querySelector('line');

  return line instanceof SVGElement ? line.style.transform : '';
}

async function hand(props: Props, personality?: 'default' | 'quiet') {
  const { screen } = await renderWithQuery(
    <TaskClock {...props} />,
    client(personality)
  );

  return transform(screen.container);
}

async function sequence(steps: Props[]) {
  const query = client();

  const [first, ...rest] = steps;

  const { screen } = await renderWithQuery(<TaskClock {...first} />, query);

  const seen = [transform(screen.container)];

  for (const step of rest) {
    await screen.rerender(<TaskClock {...step} />);

    seen.push(transform(screen.container));
  }

  return seen;
}

test('the hand turns with the wait and each wind-up adds a turn', async () => {
  expect([
    await hand({}),
    await hand({ progress: 0.5 }),
    await hand({ progress: Number.NaN }),
    await hand({ progress: 2 }),
    await hand({ progress: 0.25, turns: 1 }),
    await hand({ progress: 0.25, turns: 1 }, 'quiet'),
  ]).toEqual([
    'rotate(0deg)',
    'rotate(180deg)',
    'rotate(0deg)',
    'rotate(360deg)',
    'rotate(450deg)',
    'rotate(90deg)',
  ]);
});

test('the hand turns on past twelve only when a new wait starts', async () => {
  expect(
    await sequence([
      { progress: 0.75, since: 'foo' },
      { progress: 0.7, since: 'foo' },
      { paused: true, progress: 0.1, since: 'foo' },
      { progress: 0.25, since: 'bar' },
    ])
  ).toEqual([
    'rotate(270deg)',
    'rotate(252deg)',
    'rotate(252deg)',
    'rotate(450deg)',
  ]);
});
