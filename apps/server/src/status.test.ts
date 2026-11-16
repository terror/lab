import type { ConversationView } from '@earendil-works/pi-durable';
import { expect, test } from 'bun:test';

import { StatusReporter } from './status';

function view(thinking: string) {
  return {
    docs: {
      'pi.live': {
        generation: {
          attempt: 1,
          message: { content: [{ thinking, type: 'thinking' }] },
        },
      },
    },
  } as unknown as ConversationView;
}

test('thinking is summarized into a throttled status', async () => {
  const sent: string[] = [];

  const reporter = new StatusReporter(async (status) => {
    sent.push(status);
  }, new AbortController().signal);

  await reporter.report(view('foo'.repeat(100)));
  await reporter.report(view('foo'.repeat(200)));

  expect(sent).toEqual(['foo']);
});
