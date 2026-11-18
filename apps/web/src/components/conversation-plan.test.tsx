import { TooltipProvider } from '@/components/ui/tooltip';
import { renderWithQuery, requestUrl, stubFetch } from '@/test/helpers';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { expect, test, vi } from 'vitest';

import { Conversation } from './conversation';

type Listener = (event: { data: string }) => void;

class FakeEventSource {
  static current: FakeEventSource | undefined;

  listeners = new Map<string, Listener>();

  constructor() {
    FakeEventSource.current = this;
  }

  addEventListener(type: string, listener: Listener) {
    this.listeners.set(type, listener);
  }

  close() {}

  emit(type: string, data: unknown) {
    this.listeners.get(type)?.({ data: JSON.stringify(data) });
  }
}

test('the plan shows under the turn that wrote it and locks when the run ends', async () => {
  vi.stubGlobal('EventSource', FakeEventSource);

  const fetch = stubFetch(({ pathname }) => {
    if (pathname.endsWith('/plan')) {
      return new Response(null, { status: 204 });
    }

    return Response.json(
      pathname.endsWith('/entries') ? { items: [] } : { models: [] }
    );
  });

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

  FakeEventSource.current?.emit('value', {
    conversation: { id: 1 },
    docs: { 'pi.live': { run: {} } },
    entries: [
      {
        conversationId: 1,
        id: 2,
        kind: 'pi.assistant',
        model: [
          {
            content: [
              {
                arguments: {},
                id: 'bar',
                name: 'plan_update',
                type: 'toolCall',
              },
            ],
            role: 'assistant',
            timestamp: 0,
          },
        ],
      },
    ],
  });

  FakeEventSource.current?.emit('plan', {
    author: 'agent',
    callId: 'bar',
    steps: [{ status: 'pending', text: 'foo' }],
  });

  await screen.getByRole('checkbox', { name: 'foo' }).click();

  FakeEventSource.current?.emit('ops', [['s', ['docs', 'pi.live'], {}]]);

  await expect
    .element(screen.getByRole('checkbox', { name: 'foo' }))
    .toBeDisabled();

  expect(
    fetch.mock.calls.flatMap(([input, init]) =>
      init?.method === 'PUT'
        ? [
            {
              body: typeof init.body === 'string' && JSON.parse(init.body),
              path: requestUrl(input).pathname,
            },
          ]
        : []
    )
  ).toEqual([
    {
      body: { steps: [{ status: 'done', text: 'foo' }] },
      path: '/api/conversations/1/plan',
    },
  ]);
});
