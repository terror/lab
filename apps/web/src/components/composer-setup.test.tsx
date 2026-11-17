import { TooltipProvider } from '@/components/ui/tooltip';
import { renderWithQuery, stubFetch } from '@/test/helpers';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { expect, test } from 'vitest';

import { Composer } from './composer';

async function hint(admin: boolean) {
  stubFetch(({ pathname }) =>
    Response.json(
      pathname === '/api/profile' ? { admin } : { default: null, models: [] }
    )
  );

  const router = createRouter({
    history: createMemoryHistory(),
    routeTree: createRootRoute({
      component: () => (
        <TooltipProvider>
          <Composer
            attachments={[]}
            draft=''
            model={undefined}
            onAttachmentsChange={() => undefined}
            onDraftChange={() => undefined}
            onModelChange={() => undefined}
            onSubmit={() => undefined}
          />
        </TooltipProvider>
      ),
    }),
  });

  const { screen } = await renderWithQuery(<RouterProvider router={router} />);

  const text = admin
    ? 'Add a model provider in Settings → Providers to start chatting.'
    : 'Lab doesn’t have any models yet. Ask the admin to add a provider.';

  await expect.element(screen.getByText(text)).toBeVisible();

  await screen.unmount();
}

test('without any models the composer says how to get some', async () => {
  await hint(false);
  await hint(true);
});
