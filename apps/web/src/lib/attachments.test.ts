import { expect, test } from 'vitest';

import { textLimit } from './attachments';

function limit(contextWindow: number) {
  return textLimit({ contextWindow, name: 'foo' });
}

test('attachment text is limited by the model context window', () => {
  expect([
    textLimit(undefined),
    limit(272_000),
    limit(1_000_000),
    limit(2_000_000),
  ]).toEqual([
    { chars: 200_000, model: 'this model' },
    { chars: 544_000, model: 'foo' },
    { chars: 2_000_000, model: 'foo' },
    { chars: 4_000_000, model: 'foo' },
  ]);
});
