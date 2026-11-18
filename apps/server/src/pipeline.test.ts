import { expect, spyOn, test } from 'bun:test';

import { signIn } from '../test/auth';
import { create } from '../test/client';
import { entryPipeline } from './pipeline';

test('the backfill skips a row that fails to save and continues', async () => {
  const headers = await signIn();

  const [foo, bar] = [await create(headers), await create(headers)];

  const error = new Error('baz');

  const report = spyOn(console, 'error').mockImplementation(() => undefined);

  const saved = new Set<number>();

  let failing: number | undefined;

  await entryPipeline({
    keep: () => true,
    name: 'qux',
    rows: (entries) =>
      entries.map(({ conversationId, id }) => ({
        conversationId,
        entryId: id,
      })),
    store: async (rows) => {
      failing ??= rows.find(
        ({ conversationId }) => conversationId === foo
      )?.entryId;

      if (
        rows.some(
          ({ conversationId, entryId }) =>
            conversationId === foo && entryId === failing
        )
      ) {
        throw error;
      }

      for (const { conversationId } of rows) {
        saved.add(conversationId);
      }
    },
  }).backfill();

  expect({
    reports: report.mock.calls.filter(
      ([message]) =>
        typeof message === 'string' && message.startsWith('Skipped')
    ),
    saved: [foo, bar].filter((id) => saved.has(id)),
  }).toEqual({
    reports: [
      [
        `Skipped entry ${failing} of conversation ${foo} in the qux backfill`,
        error,
      ],
    ],
    saved: [foo, bar],
  });
});
