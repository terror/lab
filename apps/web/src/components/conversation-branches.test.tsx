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

const model = {
  contextWindow: 1_000,
  id: 'foo',
  name: 'Foo',
  provider: 'bar',
  providerName: 'Bar',
  thinkingLevels: [],
};

async function open(forks: unknown[] = []) {
  vi.stubGlobal('EventSource', FakeEventSource);

  const fetch = stubFetch(({ pathname }) => {
    const responses: Record<string, () => Response> = {
      '/api/conversations/1': () =>
        Response.json({ forks, id: 1, projectId: null, running: false }),
      '/api/conversations/1/branches': () =>
        Response.json({ id: 2 }, { status: 201 }),
      '/api/models': () => Response.json({ default: null, models: [model] }),
    };

    return responses[pathname]?.() ?? Response.json({});
  });

  fetch.mockClear();

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
    docs: {},
    entries: [
      {
        conversationId: 1,
        data: { text: 'foo' },
        id: 5,
        kind: 'lab.message',
        model: [{ content: 'foo', role: 'user', timestamp: 0 }],
      },
      {
        conversationId: 1,
        id: 7,
        kind: 'pi.assistant',
        model: [
          {
            content: [{ text: 'bar', type: 'text' }],
            model: 'foo',
            provider: 'bar',
            role: 'assistant',
            timestamp: 0,
          },
        ],
      },
    ],
  });

  return { fetch, router, screen };
}

async function branched(
  act: (screen: Awaited<ReturnType<typeof open>>['screen']) => Promise<void>,
  body: object
) {
  const { fetch, router, screen } = await open();

  await act(screen);

  await expect.poll(() => router.state.location.pathname).toBe('/c/2');

  expect(
    fetch.mock.calls.flatMap(([input, init]) =>
      requestUrl(input).pathname.endsWith('/branches') &&
      typeof init?.body === 'string'
        ? [JSON.parse(init.body)]
        : []
    )
  ).toEqual([body]);

  await screen.unmount();
}

test('messages and replies branch into a new chat', async () => {
  await branched(
    (screen) => screen.getByRole('button', { name: 'Retry' }).click(),
    { entryId: 7, kind: 'retry' }
  );

  await branched(
    async (screen) => {
      await screen
        .getByRole('button', { name: 'Retry with another model' })
        .click();
      await screen.getByRole('menuitem', { name: /^Foo/ }).click();
    },
    {
      entryId: 7,
      kind: 'retry',
      model: { id: 'foo', provider: 'bar', thinkingLevel: 'off' },
    }
  );

  await branched(
    async (screen) => {
      await screen.getByRole('button', { name: 'Edit' }).click();

      const form = screen.getByRole('form', { name: 'Edit message' });

      await form.getByRole('textbox').fill('baz');
      await form.getByRole('button', { name: 'Send' }).click();
    },
    { content: 'baz', entryId: 5, kind: 'edit' }
  );
});

test('versions link the chats that branch at a message', async () => {
  const { screen } = await open([
    { after: null, chats: [3, 1] },
    { after: 5, chats: [1, 2] },
  ]);

  const versions = screen.getByRole('navigation', { name: 'Versions' });

  const message = versions.nth(0);
  const reply = versions.nth(1);

  await expect.element(message).toHaveTextContent('2 / 2');
  await expect.element(reply).toHaveTextContent('1 / 2');

  await expect
    .element(message.getByRole('link', { name: 'Previous version' }))
    .toHaveAttribute('href', '/c/3');
  await expect
    .element(reply.getByRole('link', { name: 'Next version' }))
    .toHaveAttribute('href', '/c/2');
  await expect
    .element(reply.getByRole('button', { name: 'Previous version' }))
    .toBeDisabled();
});

test('cancelling an edit gives focus back to Edit', async () => {
  const { screen } = await open();

  await screen.getByRole('button', { name: 'Edit' }).click();

  await screen
    .getByRole('form', { name: 'Edit message' })
    .getByRole('button', { name: 'Cancel' })
    .click();

  await expect
    .element(screen.getByRole('button', { name: 'Edit' }))
    .toHaveFocus();

  await screen.unmount();
});
