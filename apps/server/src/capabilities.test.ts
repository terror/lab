import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { schema } from '@lab/db';
import { expect, test } from 'bun:test';

import { signIn } from '../test/auth';
import { call, chat, settle } from '../test/client';
import { script, toolCall } from '../test/models';
import { db } from './db';

test('a capability counts as tried once a chat has used it', async () => {
  const headers = await signIn();

  const before = await call(headers, 'GET', '/capabilities');

  script(
    toolCall('plan_update', { steps: [{ status: 'pending', text: 'foo' }] }),
    fauxAssistantMessage('bar')
  );

  const id = await chat(headers, { content: 'baz' });

  const { body: session } = await call(headers, 'GET', '/auth/get-session');

  await db.insert(schema.artifactState).values({
    artifactId: 'foo',
    conversationId: id,
    key: 'bar',
    ownerId: session.user.id,
    value: '1',
  });

  const { body: entries } = await call(
    headers,
    'GET',
    `/conversations/${id}/entries?order=ascending`
  );

  const { body: branch } = await call(
    headers,
    'POST',
    `/conversations/${id}/branches`,
    { entryId: entries.items.at(-1).id, kind: 'retry' }
  );

  await settle(branch.id);

  const after = await call(headers, 'GET', '/capabilities');

  expect({ after: after.body, before: before.body }).toEqual({
    after: {
      tried: {
        apps: true,
        branches: true,
        helpers: false,
        images: false,
        plan: true,
        schedules: false,
      },
    },
    before: {
      tried: {
        apps: false,
        branches: false,
        helpers: false,
        images: false,
        plan: false,
        schedules: false,
      },
    },
  });
});
