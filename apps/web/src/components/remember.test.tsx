import { renderWithQuery } from '@/test/helpers';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { expect, test } from 'vitest';

import { toolRenderer } from './tools';

test('a saved memory shows in the reply', async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routeTree: createRootRoute({
      component: () =>
        toolRenderer('remember').inline?.({
          active: false,
          args: { text: 'foo' },
          callId: 'bar',
          details: { id: 'baz', text: 'foo' },
          history: [],
          output: '',
        }),
    }),
  });

  const { screen } = await renderWithQuery(<RouterProvider router={router} />);

  await expect.element(screen.getByText('Remembered')).toBeVisible();

  expect(screen.container.textContent).toBe('RememberedfooManage');
});

test('a forget that failed shows no chip', () => {
  expect(
    toolRenderer('forget').inline?.({
      active: false,
      args: { id: 'baz' },
      callId: 'bar',
      details: undefined,
      history: [
        {
          args: { text: 'foo' },
          details: { id: 'baz', text: 'foo' },
          name: 'remember',
        },
      ],
      output: 'No memory has the id baz.',
    })
  ).toBeUndefined();
});
