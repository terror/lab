import { TooltipProvider } from '@/components/ui/tooltip';
import { renderWithQuery, requestUrl, stubFetch } from '@/test/helpers';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { afterEach, expect, test, vi } from 'vitest';

import { Conversation } from './conversation';

afterEach(() => {
  Reflect.deleteProperty(document, 'hidden');
});

function hide(hidden: boolean) {
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => hidden,
  });

  document.dispatchEvent(new Event('visibilitychange'));
}

async function open() {
  vi.stubGlobal(
    'EventSource',
    class {
      addEventListener() {}
      close() {}
    }
  );

  const fetch = stubFetch(() => Response.json({}));

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

  return () =>
    fetch.mock.calls
      .filter(([, init]) => init?.method === 'POST')
      .map(([input]) => requestUrl(input).pathname);
}

test('viewing an idle chat marks it read', async () => {
  const posts = await open();

  await expect.poll(posts).toEqual(['/api/conversations/1/read']);
});

test('a chat in a hidden tab stays unread until the tab returns', async () => {
  hide(true);

  const posts = await open();

  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);

  expect(posts()).toEqual([]);

  hide(false);

  await expect.poll(posts).toEqual(['/api/conversations/1/read']);
});
