import { Button } from '@/components/ui/button';
import { preferencesQueryOptions } from '@/lib/preferences';
import { renderWithQuery } from '@/test/helpers';
import { defaultPreferences } from '@lab/server/schemas';
import { QueryClient } from '@tanstack/react-query';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { useState } from 'react';
import { expect, test } from 'vitest';
import '@/index.css';

import { ToolCards } from './tool-steps';
import { toolRenderer } from './tools';

const saved = {
  details: { id: 'baz', text: 'foo' },
  output: '',
  status: 'done',
} as const;

function Remember({ live }: { live: boolean }) {
  const [result, setResult] = useState(live ? undefined : saved);

  return (
    <>
      <Button onClick={() => setResult(saved)}>baz</Button>
      <ToolCards
        call={{
          arguments: { text: 'foo' },
          id: 'bar',
          name: 'remember',
          type: 'toolCall',
        }}
        progress={undefined}
        result={result}
        working
      />
    </>
  );
}

async function remember(personality: 'default' | 'quiet', live: boolean) {
  const client = new QueryClient();

  client.setQueryData(preferencesQueryOptions.queryKey, {
    ...defaultPreferences,
    personality,
  });

  const router = createRouter({
    history: createMemoryHistory(),
    routeTree: createRootRoute({ component: () => <Remember live={live} /> }),
  });

  const { screen } = await renderWithQuery(
    <RouterProvider router={router} />,
    client
  );

  await screen.getByRole('button', { name: 'baz' }).click();

  const note = screen.getByText('foo');

  await expect.element(note).toBeVisible();

  const ribbon = screen.container.querySelector('[data-slot=chip] svg');

  const flourish = {
    ribbon: ribbon && getComputedStyle(ribbon).animationName,
    sweep: getComputedStyle(note.element(), '::before').animationName,
  };

  await screen.unmount();

  return flourish;
}

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

test('a memory saved while the chat is open drops its ribbon and sweeps a highlight', async () => {
  expect([
    await remember('default', true),
    await remember('default', false),
    await remember('quiet', true),
  ]).toEqual([
    { ribbon: 'ribbon-drop', sweep: 'highlight-sweep, highlight-fade' },
    { ribbon: 'none', sweep: 'none' },
    { ribbon: 'none', sweep: 'none' },
  ]);
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
