import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';

import { Composer } from './composer';

const matchMedia = window.matchMedia.bind(window);

afterEach(() => {
  vi.restoreAllMocks();
});

async function enter(pointer: 'coarse' | 'fine') {
  vi.spyOn(window, 'fetch').mockImplementation(async () =>
    Response.json({ default: null, models: [] })
  );

  vi.spyOn(window, 'matchMedia').mockImplementation((query) =>
    query === '(pointer: coarse)'
      ? matchMedia(pointer === 'coarse' ? 'all' : 'not all')
      : matchMedia(query)
  );

  const onSubmit = vi.fn();

  const screen = await render(
    <QueryClientProvider client={new QueryClient()}>
      <Composer
        attachments={[]}
        draft='foo'
        model={undefined}
        onAttachmentsChange={() => undefined}
        onDraftChange={() => undefined}
        onModelChange={() => undefined}
        onSubmit={onSubmit}
      />
    </QueryClientProvider>
  );

  await screen.getByLabelText('Message').click();
  await userEvent.keyboard('{Enter}');

  const calls = onSubmit.mock.calls;

  await screen.unmount();

  vi.restoreAllMocks();

  return calls;
}

test('enter sends on desktop and adds a line on touch screens', async () => {
  expect([await enter('fine'), await enter('coarse')]).toEqual([[['foo']], []]);
});
