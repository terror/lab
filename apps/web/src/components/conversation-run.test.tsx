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

function user(id: number) {
  return {
    conversationId: 1,
    data: { text: 'foo' },
    id,
    kind: 'lab.message',
    model: [{ content: 'foo', role: 'user', timestamp: 0 }],
  };
}

function assistant(id: number, content: unknown[], timestamp = 0) {
  return {
    conversationId: 1,
    id,
    kind: 'pi.assistant',
    model: [{ content, durationMs: 1, role: 'assistant', timestamp }],
  };
}

function result(id: number, toolCallId: string) {
  return {
    conversationId: 1,
    id,
    kind: 'pi.tool',
    model: [
      {
        content: [{ text: 'bar', type: 'text' }],
        isError: false,
        role: 'toolResult',
        timestamp: 12_000,
        toolCallId,
        toolName: 'web_fetch',
      },
    ],
  };
}

function call(id: string) {
  return {
    arguments: { url: 'https://foo.com' },
    id,
    name: 'web_fetch',
    type: 'toolCall',
  };
}

function emit(running: boolean, entries: unknown[]) {
  FakeEventSource.current?.emit('value', {
    conversation: { id: 1 },
    docs: { 'pi.live': running ? { run: {} } : {} },
    entries,
  });
}

function box(element: Element | null | undefined) {
  const rect = element?.getBoundingClientRect();

  return rect && [Math.round(rect.top), Math.round(rect.height)];
}

test('a run’s line heads its reply from the first moment and becomes the receipt without moving anything', async () => {
  vi.stubGlobal('EventSource', FakeEventSource);

  stubFetch(({ pathname }) =>
    Response.json(
      pathname === '/api/conversations/1'
        ? { forks: [], id: 1, projectId: null, running: true }
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

  const line = () => screen.container.querySelector('[data-slot=run-line]');

  emit(true, [user(1)]);

  await expect.poll(line).not.toBeNull();

  const pending = box(line());

  const work = [
    user(1),
    assistant(2, [call('a'), call('b')]),
    result(3, 'a'),
    result(4, 'b'),
  ];

  emit(true, [...work, assistant(5, [{ text: 'baz', type: 'text' }], 12_000)]);

  await expect.element(screen.getByText('baz')).toBeVisible();

  const answer = () => box(screen.getByText('baz').element());

  const live = [box(line()), answer()];

  emit(false, [...work, assistant(5, [{ text: 'baz', type: 'text' }], 12_000)]);

  await expect.element(screen.getByText('Worked for 12s')).toBeVisible();

  expect({
    line: [pending, live[0], box(line())],
    moved: [live[1], answer()],
  }).toEqual({
    line: [pending, pending, pending],
    moved: [live[1], live[1]],
  });
});
