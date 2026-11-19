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

test('a chat stays at its end while its last reply finishes loading', async () => {
  vi.stubGlobal('EventSource', FakeEventSource);

  stubFetch(({ pathname }) =>
    Response.json(
      pathname === '/api/conversations/1'
        ? { forks: [], id: 1, projectId: null, running: false }
        : { default: null, models: [] }
    )
  );

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

  FakeEventSource.current?.emit('value', {
    conversation: { id: 1 },
    docs: {},
    entries: [
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
    ],
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
