import { preferencesQueryOptions } from '@/lib/preferences';
import { renderWithQuery } from '@/test/helpers';
import { defaultPreferences } from '@lab/server/schemas';
import { QueryClient } from '@tanstack/react-query';
import { expect, test } from 'vitest';

import { RollingNumber } from './rolling-number';

test('a rolling number holds still when Lab is quiet', async () => {
  async function animated(personality: 'default' | 'quiet') {
    const client = new QueryClient();

    client.setQueryData(preferencesQueryOptions.queryKey, {
      ...defaultPreferences,
      personality,
    });

    const { screen } = await renderWithQuery(
      <RollingNumber value={1} />,
      client
    );

    const flow = screen.container.querySelector('number-flow-react');

    return flow !== null && 'animated' in flow && flow.animated;
  }

  expect(await animated('default')).toBe(true);
  expect(await animated('quiet')).toBe(false);
});
