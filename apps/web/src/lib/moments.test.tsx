import '@/index.css';
import { LiveMark } from '@/components/ui/live-mark';
import { preferencesQueryOptions } from '@/lib/preferences';
import { clearStored } from '@/lib/storage';
import { renderWithQuery } from '@/test/helpers';
import { defaultPreferences } from '@lab/server/schemas';
import { QueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { cdp } from 'vitest/browser';

import { useMoment } from './moment';
import { type Moment, type MomentId, moments } from './moments';

vi.mock('@/lib/confetti', () => ({ confetti: vi.fn() }));

const entries = Object.entries(moments) as [MomentId, Moment][];

const ids = entries.map(([id]) => id);

test('every moment is filed in order under a surface, says when it plays, caps its landmarks, and waits only for a request', () => {
  expect({
    adrift: entries
      .filter(
        ([, { budget, hidden, ms }]) =>
          hidden !== undefined && budget === undefined && ms === undefined
      )
      .map(([id]) => id),
    filed: ids.filter((id) => !/^[a-z]+\.[a-z]+(-[a-z]+)*$/.test(id)),
    ordered: ids.toSorted(),
    said: entries
      .filter(([, { use }]) => !/^[A-Z].+\.$/.test(use))
      .map(([id]) => id),
    uncapped: entries
      .filter(
        ([, moment]) =>
          moment.tier === 'landmark' &&
          !moment.budget.some(({ per }) => per === 'day' || per === 'ever')
      )
      .map(([id]) => id),
  }).toEqual({ adrift: [], filed: [], ordered: ids, said: [], uncapped: [] });
});

function Probe({ fire, id }: { fire: boolean; id: MomentId }) {
  const anchor = useRef<HTMLOutputElement>(null);

  const { on } = useMoment<MomentId>(id, {
    anchor,
    subject: 'foo',
    when: fire,
  });

  return (
    <output ref={anchor} data-on={on || undefined}>
      {id}
    </output>
  );
}

async function playing(
  asked: readonly MomentId[],
  personality: 'default' | 'quiet' = 'default'
) {
  const client = new QueryClient();

  client.setQueryData(preferencesQueryOptions.queryKey, {
    ...defaultPreferences,
    personality,
  });

  const probes = (fire: boolean) =>
    asked.map((id, index) => <Probe key={index} fire={fire} id={id} />);

  const { screen } = await renderWithQuery(probes(false), client);

  await screen.rerender(probes(true));

  const on = [...screen.container.querySelectorAll('[data-on]')].map(
    ({ textContent }) => textContent
  );

  await screen.unmount();

  clearStored();

  return on;
}

test('every budget grants exactly its smallest limit when asked once too often', async () => {
  const budgeted = entries.flatMap(([id, { budget }]) =>
    budget ? [{ id, most: Math.min(...budget.map(({ max }) => max)) }] : []
  );

  const granted = await playing(
    budgeted.flatMap(({ id, most }) =>
      Array.from({ length: most + 1 }, () => id)
    )
  );

  expect(granted).toEqual(
    budgeted.flatMap(({ id, most }) => Array.from({ length: most }, () => id))
  );
});

test('Quiet and reduced motion turn off exactly the moments that say so', async ({
  onTestFinished,
}) => {
  const lively = await playing(ids);

  const quiet = await playing(ids, 'quiet');

  await cdp().send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });

  onTestFinished(async () => {
    await cdp().send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: '' }],
    });
  });

  expect({ lively, quiet, reduced: await playing(ids) }).toEqual({
    lively: ids,
    quiet: ids.filter((id) => moments[id].quiet === 'keep'),
    reduced: ids.filter((id) => moments[id].reduced === 'still'),
  });
});

test('every shot lasts as long as the mark animation it times', async () => {
  const shots = entries.flatMap(([id, { mark, ms }]) =>
    mark === undefined || ms === undefined ? [] : [{ id, mark, ms }]
  );

  const screen = await render(
    shots.map(({ id, mark }) => (
      <LiveMark key={id} data-moment={id} state={mark} />
    ))
  );

  const drift = shots.flatMap(({ id, ms }) => {
    const animations =
      screen.container
        .querySelector(`[data-moment='${id}']`)
        ?.getAnimations({ subtree: true }) ?? [];

    const longest = Math.max(
      ...animations.map(({ effect }) =>
        Number(effect?.getComputedTiming().endTime)
      )
    );

    return ms >= longest && ms <= longest + 400 ? [] : [{ id, longest, ms }];
  });

  expect(drift).toEqual([]);
});
