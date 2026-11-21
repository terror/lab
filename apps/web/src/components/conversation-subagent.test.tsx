import { TooltipProvider } from '@/components/ui/tooltip';
import { renderWithQuery, stubFetch } from '@/test/helpers';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import '@/index.css';

import { Conversation } from './conversation';

type Listener = (event: { data: string }) => void;

const sources = new Map<string, Map<string, Listener>>();

class Source {
  listeners = new Map<string, Listener>();

  constructor(url: string | URL) {
    sources.set(new URL(url, window.location.href).pathname, this.listeners);
  }

  addEventListener(type: string, listener: Listener) {
    this.listeners.set(type, listener);
  }

  close() {}
}

function emit(path: string, entries: unknown[]) {
  sources.get(path)?.get('value')?.({
    data: JSON.stringify({
      conversation: { id: 1 },
      docs: { 'pi.live': {} },
      entries,
    }),
  });
}

const subagents = [
  { id: 2, status: 'done', summary: 'qux', title: 'foo' },
  { id: 3, status: 'running', title: 'bar' },
  { id: 4, status: 'failed', summary: 'bob', title: 'baz' },
];

const chat = [
  {
    conversationId: 1,
    id: 1,
    kind: 'pi.assistant',
    model: [
      {
        content: [
          { arguments: {}, id: 'a', name: 'delegate', type: 'toolCall' },
        ],
        role: 'assistant',
        timestamp: 0,
      },
    ],
  },
  {
    conversationId: 1,
    id: 2,
    kind: 'pi.tool',
    model: [
      {
        content: [{ text: 'qux', type: 'text' }],
        details: { subagents },
        isError: false,
        role: 'toolResult',
        timestamp: 0,
        toolCallId: 'a',
        toolName: 'delegate',
      },
    ],
  },
];

const brief = 'foo '.repeat(400).trim();

const thread = [
  {
    conversationId: 2,
    id: 1,
    kind: 'pi.user',
    model: [{ content: brief, role: 'user', timestamp: 0 }],
  },
  {
    conversationId: 2,
    id: 2,
    kind: 'pi.assistant',
    model: [
      {
        content: [{ text: 'qux', type: 'text' }],
        role: 'assistant',
        timestamp: 0,
      },
    ],
  },
];

async function open(width: number) {
  await page.viewport(width, 800);

  sources.clear();

  vi.stubGlobal('EventSource', Source);

  stubFetch(() => Response.json({}));

  const onAgent = vi.fn();

  const router = createRouter({
    history: createMemoryHistory(),
    routeTree: createRootRoute({
      component: () => (
        <TooltipProvider>
          <Conversation agent={2} id={1} onAgent={onAgent} />
        </TooltipProvider>
      ),
    }),
  });

  const { screen } = await renderWithQuery(<RouterProvider router={router} />);

  await expect
    .poll(() => [...sources.keys()].toSorted())
    .toEqual([
      '/api/conversations/1/events',
      '/api/conversations/1/subagents/2/events',
    ]);

  emit('/api/conversations/1/events', chat);

  emit('/api/conversations/1/subagents/2/events', thread);

  return {
    onAgent,
    pane: screen.getByRole('region', { name: 'Subagent' }),
    screen,
  };
}

test('a subagent opens beside its chat as a read-only thread that steps through its lanes', async () => {
  const { onAgent, pane, screen } = await open(1280);

  await expect.element(pane.getByText('Brief from Lab')).toBeVisible();

  await pane.getByRole('button', { name: 'Show the whole brief' }).click();

  await expect
    .element(pane.getByRole('button', { name: 'Show less' }))
    .toBeVisible();

  const header = pane.element().querySelector('header')?.textContent;

  const footer = pane.element().querySelector('footer')?.textContent;

  const current = screen
    .getByRole('button', { name: /^(foo|bar|baz)/ })
    .elements()
    .map((lane) => lane.getAttribute('aria-current'));

  await pane.getByRole('button', { name: 'Next subagent' }).click();
  await pane.getByRole('button', { name: 'Previous subagent' }).click();
  await screen.getByRole('button', { name: /^bar/ }).click();
  await pane.getByRole('button', { name: 'Close' }).click();

  expect({
    calls: onAgent.mock.calls,
    current,
    footer,
    header,
  }).toEqual({
    calls: [[3], [4], [3], [undefined]],
    current: ['true', null, null],
    footer: 'Read-only. Lab has this subagent’s report.',
    header: 'fooDone· Subagent of this chat1 of 3',
  });
});

test('on a phone a subagent opens in a sheet that Escape closes', async () => {
  const { onAgent } = await open(414);

  await expect
    .element(page.getByRole('dialog').getByText('Brief from Lab'))
    .toBeVisible();

  await userEvent.keyboard('{Escape}');

  await expect.poll(() => onAgent.mock.calls).toEqual([[undefined]]);
});
