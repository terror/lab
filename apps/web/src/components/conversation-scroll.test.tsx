import { TooltipProvider } from '@/components/ui/tooltip';
import { FakeEventSource, renderWithQuery, stubFetch } from '@/test/helpers';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { expect, test, vi } from 'vitest';
import '@/index.css';

import { Conversation } from './conversation';

async function open(
  running: () => boolean,
  summary: Promise<void> = Promise.resolve(),
  served: (running: boolean) => void = () => undefined
) {
  vi.stubGlobal('EventSource', FakeEventSource);

  stubFetch(async ({ pathname }) => {
    if (pathname !== '/api/conversations/1') {
      return Response.json({ default: null, models: [] });
    }

    await summary;

    served(running());

    return Response.json({
      forks: [],
      id: 1,
      projectId: null,
      running: running(),
    });
  });

  const router = createRouter({
    history: createMemoryHistory(),
    routeTree: createRootRoute({
      component: () => (
        <TooltipProvider>
          <div className='flex h-96 flex-col'>
            <Conversation id={1} />
          </div>
        </TooltipProvider>
      ),
    }),
  });

  const { screen } = await renderWithQuery(<RouterProvider router={router} />);

  await expect.poll(() => FakeEventSource.current).toBeDefined();

  return screen;
}

const entries = [
  {
    conversationId: 1,
    data: { text: 'foo' },
    id: 1,
    kind: 'lab.message',
    model: [{ content: 'foo', role: 'user', timestamp: 0 }],
  },
  {
    conversationId: 1,
    id: 2,
    kind: 'pi.assistant',
    model: [
      {
        content: [{ text: 'bar', type: 'text' }],
        role: 'assistant',
        timestamp: 0,
      },
    ],
  },
];

test('a chat stays at its end while its last reply finishes loading', async () => {
  const screen = await open(() => false);

  FakeEventSource.current?.emit('value', {
    conversation: { id: 1 },
    docs: {},
    entries,
  });

  const transcript = screen.getByRole('region', { name: 'Transcript' });

  await expect.element(screen.getByText('bar')).toBeVisible();

  const reply = screen.container.querySelector<HTMLElement>(
    '[data-slot=message][data-align=start]'
  );

  reply?.style.setProperty('height', '2000px');

  await expect
    .poll(() => {
      const viewport = transcript.element();

      return viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop;
    })
    .toBe(0);
});

test('a long reply stays in place when its turn ends', async () => {
  let running = true;

  const summary = Promise.withResolvers<void>();

  const ended = Promise.withResolvers<void>();

  const screen = await open(
    () => running,
    summary.promise,
    (value) => !value && ended.resolve()
  );

  FakeEventSource.current?.emit('value', {
    conversation: { id: 1 },
    docs: { 'pi.live': { run: {} } },
    entries,
  });

  const transcript = screen.getByRole('region', { name: 'Transcript' });

  await expect.element(screen.getByText('bar')).toBeVisible();

  const reply = screen.container.querySelector<HTMLElement>(
    '[data-slot=message][data-align=start]'
  );

  reply?.style.setProperty('height', '1000px');

  await new Promise((resolve) => setTimeout(resolve, 300));

  summary.resolve();

  await new Promise((resolve) => setTimeout(resolve, 300));

  reply?.style.setProperty('height', '2000px');

  await new Promise((resolve) => setTimeout(resolve, 300));

  const top = transcript.element().scrollTop;

  running = false;

  FakeEventSource.current?.emit('ops', [['s', ['docs', 'pi.live'], {}]]);

  await ended.promise;

  await new Promise((resolve) => setTimeout(resolve, 100));

  expect(transcript.element().scrollTop).toBe(top);
});
