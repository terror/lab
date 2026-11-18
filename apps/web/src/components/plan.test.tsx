import { ToolConversation } from '@/components/tools';
import { confetti } from '@/lib/confetti';
import { preferencesQueryOptions } from '@/lib/preferences';
import { renderWithQuery, requestUrl, stubFetch } from '@/test/helpers';
import { defaultPreferences } from '@lab/server/schemas';
import { QueryClient } from '@tanstack/react-query';
import { expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import { Plan } from './plan';

vi.mock('@/lib/confetti', () => ({ confetti: vi.fn() }));

test('each edit sends the whole plan', async () => {
  const fetch = stubFetch(() => new Response(null, { status: 204 }));

  const { screen } = await renderWithQuery(
    <ToolConversation value={7}>
      <Plan
        editable
        steps={[
          { status: 'done', text: 'foo' },
          { status: 'active', text: 'bar' },
          { status: 'pending', text: 'baz' },
        ]}
      />
    </ToolConversation>
  );

  await screen.getByRole('checkbox', { name: 'baz' }).click();
  await screen.getByRole('button', { name: 'Move “baz” up' }).click();
  await screen.getByRole('button', { name: 'Remove “foo”' }).click();
  await screen.getByRole('button', { name: 'Edit “bar”' }).click();
  await screen.getByRole('textbox', { name: 'Edit “bar”' }).fill('qux');
  await userEvent.keyboard('{Enter}');
  await screen.getByRole('textbox', { name: 'Add a step' }).fill('quux');
  await userEvent.keyboard('{Enter}');

  await expect
    .poll(() =>
      fetch.mock.calls
        .filter(([, init]) => init?.method === 'PUT')
        .map(([input, init]) => ({
          body: typeof init?.body === 'string' && JSON.parse(init.body),
          method: init?.method,
          path: requestUrl(input).pathname,
        }))
    )
    .toEqual(
      [
        [
          { status: 'done', text: 'foo' },
          { status: 'active', text: 'bar' },
          { status: 'done', text: 'baz' },
        ],
        [
          { status: 'done', text: 'foo' },
          { status: 'done', text: 'baz' },
          { status: 'active', text: 'bar' },
        ],
        [
          { status: 'done', text: 'baz' },
          { status: 'active', text: 'bar' },
        ],
        [
          { status: 'done', text: 'baz' },
          { status: 'active', text: 'qux' },
        ],
        [
          { status: 'done', text: 'baz' },
          { status: 'active', text: 'qux' },
          { status: 'pending', text: 'quux' },
        ],
      ].map((steps) => ({
        body: { steps },
        method: 'PUT',
        path: '/api/conversations/7/plan',
      }))
    );
});

function plan(status: 'active' | 'done') {
  return (
    <Plan
      editable
      steps={[
        { status: 'done', text: 'foo' },
        { status, text: 'bar' },
      ]}
    />
  );
}

test('a plan celebrates once when its last step is done', async () => {
  const { screen } = await renderWithQuery(plan('active'));

  await screen.rerender(plan('done'));
  await screen.rerender(plan('active'));
  await screen.rerender(plan('done'));

  expect(
    vi
      .mocked(confetti)
      .mock.calls.map(([element]) => element.getAttribute('data-slot'))
  ).toEqual(['progress-count']);
});

test('a plan finishes without confetti when Lab is quiet', async () => {
  const client = new QueryClient();

  client.setQueryData(preferencesQueryOptions.queryKey, {
    ...defaultPreferences,
    personality: 'quiet',
  });

  const { screen } = await renderWithQuery(plan('active'), client);

  await screen.rerender(plan('done'));

  expect(vi.mocked(confetti)).not.toHaveBeenCalled();
});
