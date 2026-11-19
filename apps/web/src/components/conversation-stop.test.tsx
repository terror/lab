import { TooltipProvider } from '@/components/ui/tooltip';
import { renderWithQuery, stubFetch } from '@/test/helpers';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { expect, test, vi } from 'vitest';
import '@/index.css';

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

test('a stopped turn ends in place with its status above what to do next', async () => {
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

  FakeEventSource.current?.emit('value', {
    conversation: { id: 1 },
    docs: { 'pi.live': { run: {} } },
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
            content: [
              {
                arguments: { url: 'https://foo.com' },
                id: 'bar',
                name: 'web_fetch',
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

  const reply = () =>
    screen.container.querySelector('[data-slot=message][data-align=start]');

  await expect.poll(reply).not.toBeNull();

  const top = reply()?.getBoundingClientRect().top;

  FakeEventSource.current?.emit('ops', [
    [
      's',
      ['docs', 'pi.live'],
      { runFailure: { inputs: [], reason: 'aborted', taskId: 3 } },
    ],
  ]);

  await expect.element(screen.getByRole('alert')).toHaveTextContent('Stopped');

  expect({
    actions: [
      ...(reply()?.querySelectorAll('[data-slot=message-footer] button') ?? []),
    ].map((button) => button.getAttribute('aria-label')),
    status: reply()?.querySelector('[role=alert]')?.textContent,
    top: reply()?.getBoundingClientRect().top,
  }).toEqual({
    actions: ['Retry', 'Retry with another model'],
    status: 'Stopped',
    top,
  });
});

test('sending a message posts it and empties the composer', async () => {
  vi.stubGlobal('EventSource', FakeEventSource);

  const sent: unknown[] = [];

  stubFetch(({ pathname }, init) => {
    if (pathname === '/api/conversations/3/messages') {
      sent.push(typeof init?.body === 'string' && JSON.parse(init.body));

      return new Response(null, { status: 202 });
    }

    return Response.json(
      pathname === '/api/conversations/3'
        ? { forks: [], id: 3, projectId: null, running: false }
        : { default: null, models: [] }
    );
  });

  const router = createRouter({
    history: createMemoryHistory(),
    routeTree: createRootRoute({
      component: () => (
        <TooltipProvider>
          <Conversation id={3} />
        </TooltipProvider>
      ),
    }),
  });

  const { screen } = await renderWithQuery(<RouterProvider router={router} />);

  await expect.poll(() => FakeEventSource.current).toBeDefined();

  FakeEventSource.current?.emit('value', {
    conversation: { id: 3 },
    docs: {},
    entries: [],
  });

  const message = screen.getByRole('textbox', { name: 'Message' });

  await message.fill('foo');
  await screen.getByRole('button', { name: 'Send' }).click();

  await expect.element(message).toHaveValue('');

  expect(sent).toEqual([{ attachments: [], content: 'foo', steer: false }]);
});

test('stopping puts queued messages back in the composer', async () => {
  vi.stubGlobal('EventSource', FakeEventSource);

  stubFetch(({ pathname }) => {
    if (pathname === '/api/conversations/2/abort') {
      return new Response(null, { status: 204 });
    }

    return Response.json(
      pathname === '/api/conversations/2'
        ? { forks: [], id: 2, projectId: null, running: true }
        : { default: null, models: [] }
    );
  });

  const router = createRouter({
    history: createMemoryHistory(),
    routeTree: createRootRoute({
      component: () => (
        <TooltipProvider>
          <Conversation id={2} />
        </TooltipProvider>
      ),
    }),
  });

  const { screen } = await renderWithQuery(<RouterProvider router={router} />);

  await expect.poll(() => FakeEventSource.current).toBeDefined();

  FakeEventSource.current?.emit('value', {
    conversation: { id: 2 },
    docs: {
      'pi.inbox': {
        items: [
          {
            content: 'foo\n\n<file name="bar.txt">\nbaz\n</file>',
            entry: {
              data: {
                files: [{ name: 'bar.txt', text: 'baz', type: 'file' }],
                text: 'foo',
              },
              kind: 'lab.message',
            },
            id: 3,
            mode: 'followUp',
          },
        ],
      },
      'pi.live': { run: {} },
    },
    entries: [],
  });

  await screen.getByRole('button', { name: 'Stop' }).click();

  await expect
    .element(screen.getByRole('textbox', { name: 'Message' }))
    .toHaveValue('foo');
  await expect
    .element(screen.getByRole('button', { name: 'Remove bar.txt' }))
    .toBeVisible();
});
