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

function entry(id: number, message: object) {
  return { conversationId: 1, id, kind: 'pi.entry', model: [message] };
}

function call(id: string, name: string, args: object) {
  return { arguments: args, id, name, type: 'toolCall' };
}

function emit(running: boolean, entries: unknown[]) {
  FakeEventSource.current?.emit('value', {
    conversation: { id: 1 },
    docs: { 'pi.live': running ? { run: {} } : {} },
    entries,
  });
}

const now = Date.now();

const asked = entry(1, { content: 'foo', role: 'user', timestamp: now });

const long = {
  text: Array.from({ length: 60 }, () => 'bar').join('\n\n'),
  type: 'text',
};

function reading(durationMs: number) {
  return entry(2, {
    content: [long, call('a', 'web_fetch', { url: 'https://foo.com' })],
    durationMs,
    role: 'assistant',
    timestamp: now,
  });
}

const read = entry(3, {
  content: [{ text: 'baz', type: 'text' }],
  isError: false,
  role: 'toolResult',
  timestamp: now + 12_000,
  toolCallId: 'a',
  toolName: 'web_fetch',
});

const asking = entry(4, {
  content: [
    call('b', 'ask_user', { options: ['qux'], question: 'Which one?' }),
  ],
  durationMs: 1,
  role: 'assistant',
  timestamp: now + 12_000,
});

test('the run line docks on the composer when it is out of view or Lab needs you, and the finished run hops where it is seen', async () => {
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
          <div className='flex h-96 flex-col'>
            <Conversation id={1} />
          </div>
        </TooltipProvider>
      ),
    }),
  });

  const { screen } = await renderWithQuery(<RouterProvider router={router} />);

  await expect.poll(() => FakeEventSource.current).toBeDefined();

  const tab = () =>
    screen.container.querySelector('[data-slot=run-tab]')?.textContent;

  const viewport = () =>
    screen.container.querySelector('[data-slot=message-scroller-viewport]');

  emit(true, [asked, reading(1)]);

  await expect.element(screen.getByText('Reading a page')).toBeVisible();

  viewport()?.scrollTo(0, 100_000);

  await expect.poll(tab).toBe('Reading a page');

  await screen.getByRole('button', { name: 'Show what Lab is doing' }).click();

  await expect.poll(tab).toBe(undefined);

  emit(true, [asked, reading(1), read, asking]);

  await expect.poll(tab).toBe('Needs you·Which one?');

  emit(false, [asked, reading(12_000), read]);

  await expect
    .poll(() =>
      screen.container
        .querySelector('[data-slot=run-line] [data-slot=live-mark]')
        ?.getAttribute('data-state')
    )
    .toBe('done');

  expect(tab()).toBe(undefined);
});
