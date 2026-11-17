import { renderWithQuery, requestUrl, stubFetch } from '@/test/helpers';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { expect, test, vi } from 'vitest';

import { Conversation } from './conversation';

test('viewing an idle chat marks it read', async () => {
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
    routeTree: createRootRoute({ component: () => <Conversation id={1} /> }),
  });

  await renderWithQuery(<RouterProvider router={router} />);

  await expect
    .poll(() =>
      fetch.mock.calls
        .filter(([, init]) => init?.method === 'POST')
        .map(([input]) => requestUrl(input).pathname)
    )
    .toEqual(['/api/conversations/1/read']);
});
