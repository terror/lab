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

test('earlier messages load when their place in the transcript comes into view', async () => {
  vi.stubGlobal('EventSource', FakeEventSource);

  const fetch = stubFetch(({ pathname }) =>
    Response.json(
      pathname.endsWith('/entries') ? { items: [] } : { models: [] }
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

  await renderWithQuery(<RouterProvider router={router} />);

  await expect.poll(() => FakeEventSource.current).toBeDefined();

  FakeEventSource.current?.emit('value', {
    before: 4,
    conversation: { id: 1 },
    docs: {},
    entries: [
      { conversationId: 1, data: { text: 'foo' }, id: 5, kind: 'lab.message' },
    ],
  });

  await expect
    .poll(() =>
      fetch.mock.calls.some(([input]) =>
        requestUrl(input).pathname.endsWith('/entries')
      )
    )
    .toBe(true);
});
