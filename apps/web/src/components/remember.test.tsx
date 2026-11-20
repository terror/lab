import { Button } from '@/components/ui/button';
import { spring } from '@/lib/motion';
import { renderWithQuery } from '@/test/helpers';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import * as motion from 'motion/react';
import { useState } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { cdp } from 'vitest/browser';
import '@/index.css';

import { ToolCards } from './tool-steps';
import { toolRenderer } from './tools';

const saved = {
  details: { id: 'baz', text: 'foo' },
  output: '',
  status: 'done',
} as const;

function Remember({ live, name }: { live: boolean; name: string }) {
  const [result, setResult] = useState(live ? undefined : saved);

  return (
    <>
      <Button onClick={() => setResult(saved)}>baz</Button>
      <ToolCards
        call={{
          arguments: { id: 'baz', text: 'foo' },
          id: 'bar',
          name,
          type: 'toolCall',
        }}
        progress={undefined}
        result={result}
        working
      />
    </>
  );
}

async function remember(live: boolean, name = 'remember') {
  const router = createRouter({
    history: createMemoryHistory(),
    routeTree: createRootRoute({
      component: () => <Remember live={live} name={name} />,
    }),
  });

  const { screen } = await renderWithQuery(<RouterProvider router={router} />);

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
  expect([await remember(true), await remember(false)]).toEqual([
    { ribbon: 'ribbon-drop', sweep: 'highlight-sweep, highlight-fade' },
    { ribbon: 'none', sweep: 'none' },
  ]);
});

test('a forgotten memory and reduced motion skip the ribbon, and reduced motion only fades the highlight', async ({
  onTestFinished,
}) => {
  const forgotten = await remember(true, 'forget');

  await cdp().send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });

  onTestFinished(async () => {
    await cdp().send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: '' }],
    });
  });

  expect([forgotten, await remember(true)]).toEqual([
    { ribbon: 'none', sweep: 'none' },
    { ribbon: 'none', sweep: 'highlight-show, highlight-fade' },
  ]);
});

test('the ribbon drops on a curve that follows the lively spring preset', async () => {
  const screen = await render(<span data-ribbon data-testid='foo' />);

  const style = getComputedStyle(screen.getByTestId('foo').element());

  const duration = Number.parseFloat(
    style.getPropertyValue('--lively-duration')
  );

  const generator = motion.spring({ ...spring.lively, keyframes: [0, 1] });

  const stops =
    style.getPropertyValue('--lively').match(/[\d.]+ [\d.]+%/g) ?? [];

  const drift = stops.map((stop) => {
    const [value = 0, at = 0] = stop.split(' ').map(Number.parseFloat);

    return Math.abs(generator.next((at / 100) * duration).value - value);
  });

  expect({ drift: Math.max(...drift) < 0.01, stops: stops.length }).toEqual({
    drift: true,
    stops: 60,
  });
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
