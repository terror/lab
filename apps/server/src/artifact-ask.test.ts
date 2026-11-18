import { schema } from '@lab/db';
import { expect, test } from 'bun:test';
import { and, eq } from 'drizzle-orm';

import { signIn } from '../test/auth';
import { artifactChat, call } from '../test/client';
import { db } from './db';
import { env } from './env';
import { flushHelperUsage } from './helper-usage';

test('artifacts ask a helper model within spend and rate limits', async () => {
  const headers = await signIn();

  const id = await artifactChat(headers);

  const ask = (prompt: string) =>
    call(headers, 'POST', `/conversations/${id}/artifacts/bar/ask`, {
      prompt,
    });

  const answered = await ask('foo');

  const long = await ask('x'.repeat(10_001));

  env.LAB_MONTHLY_LIMIT = 0;

  const spent = await ask('foo').finally(() => {
    env.LAB_MONTHLY_LIMIT = undefined;
  });

  for (let attempt = 0; attempt < 7; attempt += 1) {
    await ask('foo');
  }

  const limited = await ask('foo');

  await flushHelperUsage();

  const recorded = await db.$count(
    schema.usageEvent,
    and(
      eq(schema.usageEvent.conversationId, id),
      eq(schema.usageEvent.kind, 'artifact')
    )
  );

  expect({ answered, limited, long, recorded, spent }).toEqual({
    answered: { body: { text: 'foo' }, status: 200 },
    limited: {
      body: { error: 'You’re doing that too often. Try again in 60 seconds.' },
      status: 429,
    },
    long: {
      body: {
        error:
          '✖ Too big: expected string to have <=10000 characters\n  → at prompt',
      },
      status: 400,
    },
    recorded: 8,
    spent: {
      body: { error: 'You’ve used this month’s $0.00 limit' },
      status: 402,
    },
  });
});
