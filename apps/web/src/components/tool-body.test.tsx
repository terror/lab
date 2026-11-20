import { renderWithQuery } from '@/test/helpers';
import { expect, test } from 'vitest';

import { ToolBody } from './tools';

test('a failed tool explains its error and keeps the raw output', async () => {
  const { screen } = await renderWithQuery(
    <ToolBody
      active={false}
      args={{}}
      callId='baz'
      details={{
        error: {
          issues: [{ keyword: 'required', message: 'foo', path: ['bar'] }],
          kind: 'invalid',
          message: 'qux',
        },
      }}
      history={[]}
      name='qux'
      output='quux'
    />
  );

  const shown = [
    screen.getByRole('paragraph').element().textContent,
    screen
      .getByRole('listitem')
      .elements()
      .map((item) => item.textContent),
  ];

  await screen.getByRole('button', { name: 'Show raw output' }).click();

  expect([
    ...shown,
    screen.container.querySelector('pre')?.textContent,
  ]).toEqual([
    'The model sent an invalid request, so the tool didn’t run.',
    ['bar is missing'],
    'quux',
  ]);
});
