import '@/index.css';
import { TooltipProvider } from '@/components/ui/tooltip';
import { FakeEventSource, renderWithQuery, stubFetch } from '@/test/helpers';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { expect, test, vi } from 'vitest';

import { Conversation } from './conversation';

const failed = { runFailure: { inputs: [], reason: 'model_error', taskId: 3 } };

const user = {
  conversationId: 1,
  data: { text: 'foo' },
  id: 1,
  kind: 'lab.message',
  model: [{ content: 'foo', role: 'user', timestamp: 0 }],
};

const reply = {
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
};

function mark() {
  return document
    .querySelector('[role=alert] [data-slot=live-mark]')
    ?.getAttribute('data-state');
}

function live(state: object) {
  FakeEventSource.current?.emit('ops', [['s', ['docs', 'pi.live'], state]]);
}

async function failTwice(entries: unknown[]) {
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
          <Conversation id={1} />
        </TooltipProvider>
      ),
    }),
  });

  const { screen } = await renderWithQuery(<RouterProvider router={router} />);

  await expect.poll(() => FakeEventSource.current).toBeDefined();

  const send = screen.getByRole('button', { name: 'Send' });

  FakeEventSource.current?.emit('value', {
    conversation: { id: 1 },
    docs: { 'pi.live': { run: {} } },
    entries,
  });

  await expect.element(send).not.toBeInTheDocument();

  live({});

  await expect.element(send).toBeInTheDocument();

  const seen = [];

  for (const _ of [1, 2]) {
    live({ run: {} });

    await expect.element(send).not.toBeInTheDocument();

    live(failed);

    await expect.element(screen.getByRole('alert')).toBeVisible();

    seen.push(mark());
  }

  await screen.unmount();

  return seen;
}

test('only the first failed run in a row slips, with or without a reply', async () => {
  expect([await failTwice([user, reply]), await failTwice([user])]).toEqual([
    ['error', 'broken'],
    ['error', 'broken'],
  ]);
});
