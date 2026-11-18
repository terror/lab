import '@/index.css';
import { TooltipProvider } from '@/components/ui/tooltip';
import { renderWithQuery, requestUrl, stubFetch } from '@/test/helpers';
import { expect, test, vi } from 'vitest';
import { cdp, userEvent } from 'vitest/browser';

import { Composer } from './composer';

const matchMedia = window.matchMedia.bind(window);

async function enter(pointer: 'coarse' | 'fine') {
  stubFetch(() => Response.json({ default: null, models: [] }));

  vi.spyOn(window, 'matchMedia').mockImplementation((query) =>
    query === '(pointer: coarse)'
      ? matchMedia(pointer === 'coarse' ? 'all' : 'not all')
      : matchMedia(query)
  );

  const onSubmit = vi.fn();

  const { screen } = await renderWithQuery(
    <TooltipProvider>
      <Composer
        attachments={[]}
        draft='foo'
        model={undefined}
        onAttachmentsChange={() => undefined}
        onDraftChange={() => undefined}
        onModelChange={() => undefined}
        onSubmit={onSubmit}
      />
    </TooltipProvider>
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

test('a run can be stopped while a draft waits', async () => {
  stubFetch(() => Response.json({ default: null, models: [] }));

  const onStop = vi.fn();

  const { screen } = await renderWithQuery(
    <TooltipProvider>
      <Composer
        attachments={[]}
        draft='foo'
        model={undefined}
        onAttachmentsChange={() => undefined}
        onDraftChange={() => undefined}
        onModelChange={() => undefined}
        onSteer={() => undefined}
        onStop={onStop}
        onSubmit={() => undefined}
        running
      />
    </TooltipProvider>
  );

  await screen.getByRole('button', { name: 'Stop' }).click();

  expect({
    buttons: [...screen.container.querySelectorAll('button')].map((button) =>
      button.getAttribute('aria-label')
    ),
    stops: onStop.mock.calls.length,
  }).toEqual({
    buttons: [
      'Add photos and files',
      'Model',
      'Steer',
      'Dictate',
      'Send',
      'Stop',
    ],
    stops: 1,
  });
});

test('slash commands run from the composer', async () => {
  const fetch = stubFetch(() => new Response(null, { status: 202 }));

  const onDraftChange = vi.fn();

  const { screen } = await renderWithQuery(
    <TooltipProvider>
      <Composer
        attachments={[]}
        commandContext={{
          conversationId: 7,
          lastReply: undefined,
          newChat: undefined,
        }}
        draft='/'
        model={undefined}
        onAttachmentsChange={() => undefined}
        onDraftChange={onDraftChange}
        onModelChange={() => undefined}
        onSubmit={() => undefined}
      />
    </TooltipProvider>
  );

  const options = screen
    .getByRole('list', { name: 'Commands' })
    .element().textContent;

  await screen.getByLabelText('Message').click();
  await userEvent.keyboard('{Enter}');

  await expect
    .poll(() =>
      fetch.mock.calls.map(([input, init]) => [
        requestUrl(input).pathname,
        init?.method ?? (input instanceof Request ? input.method : 'GET'),
      ])
    )
    .toContainEqual(['/api/conversations/7/compact', 'POST']);

  expect({ draft: onDraftChange.mock.calls, options }).toEqual({
    draft: [['']],
    options: '/compactSummarize earlier messages to free up context',
  });
});

function composer(running: boolean) {
  return (
    <TooltipProvider>
      <Composer
        attachments={[]}
        draft='foo'
        model={undefined}
        onAttachmentsChange={() => undefined}
        onDraftChange={() => undefined}
        onModelChange={() => undefined}
        onStop={() => undefined}
        onSubmit={() => undefined}
        running={running}
      />
    </TooltipProvider>
  );
}

test('the send arrow turns into the stop square when a run starts', async () => {
  stubFetch(() => Response.json({ default: null, models: [] }));

  const { screen } = await renderWithQuery(composer(false));

  const send = screen.getByRole('button', { name: 'Send' }).element();

  await screen.rerender(composer(true));

  expect(screen.getByRole('button', { name: 'Stop' }).element()).toBe(send);
});

test('on a touch screen the buttons sit far enough apart that their hit areas never overlap', async ({
  onTestFinished,
}) => {
  await cdp().send('Emulation.setTouchEmulationEnabled', { enabled: true });

  onTestFinished(async () => {
    await cdp().send('Emulation.setTouchEmulationEnabled', { enabled: false });
  });

  stubFetch(() => Response.json({ default: null, models: [] }));

  const { screen } = await renderWithQuery(
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
  );

  const edges = ['Model', 'Dictate', 'Send'].map((name) =>
    screen.getByRole('button', { name }).element().getBoundingClientRect()
  );

  expect(
    edges.slice(1).map((edge, index) => edge.left - (edges[index]?.right ?? 0))
  ).toEqual([12, 12]);
});

test('on a phone the attach menu opens as a sheet', async () => {
  stubFetch(() => Response.json({ default: null, models: [] }));

  vi.spyOn(window, 'matchMedia').mockImplementation((query) =>
    matchMedia(
      query === '(pointer: coarse) and (max-width: 767px)' ? 'all' : query
    )
  );

  const { screen } = await renderWithQuery(
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
  );

  await screen.getByRole('button', { name: 'Add photos and files' }).click();

  const sheet = screen.getByRole('dialog', { name: 'Add to your message' });

  await expect.element(sheet).toBeVisible();

  expect(
    [...sheet.element().querySelectorAll('button')].map(
      (button) => button.textContent
    )
  ).toEqual(['Add photos & files', 'Add from library']);
});
