import { renderWithQuery } from '@/test/helpers';
import { expect, test } from 'vitest';

import { RollingNumber } from './rolling-number';

test('a rolling number animates', async () => {
  const { screen } = await renderWithQuery(<RollingNumber value={1} />);

  const flow = screen.container.querySelector('number-flow-react');

  expect(flow !== null && 'animated' in flow && flow.animated).toBe(true);
});
