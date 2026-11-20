import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { PreferencesDoc } from '@lab/harness';
import { expect, test } from 'bun:test';

import { signIn } from '../test/auth';
import { call, chat, toolOutputs } from '../test/client';
import { script, toolCall } from '../test/models';
import { harness } from './harness';

test('preferences are shared by the settings and the agent', async () => {
  const headers = await signIn();

  const initial = await call(headers, 'GET', '/preferences');

  const claims = [
    await call(headers, 'POST', '/preferences/hints', { id: 'foo' }),
    await call(headers, 'POST', '/preferences/hints', { id: 'foo' }),
  ];

  const patched = await call(headers, 'PATCH', '/preferences', {
    theme: 'light',
  });

  const invalid = await call(headers, 'PATCH', '/preferences', {
    theme: 'foo',
  });

  script(
    toolCall('preferences_update', { chat_sort: 'title', line_numbers: true }),
    fauxAssistantMessage('bar')
  );

  const id = await chat(headers, { content: 'baz' });

  expect({
    claims: claims.map(({ body }) => body.fresh),
    final: (await call(headers, 'GET', '/preferences')).body,
    initial: initial.body,
    invalid: invalid.status,
    outputs: await toolOutputs(headers, id),
    patched: patched.body,
  }).toEqual({
    claims: [true, false],
    final: {
      preferences: {
        chatSort: 'title',
        hints: ['foo'],
        lineNumbers: true,
        theme: 'light',
      },
    },
    initial: {
      preferences: {
        chatSort: 'activity',
        hints: [],
        lineNumbers: false,
        theme: 'system',
      },
    },
    invalid: 400,
    outputs: [
      "Changed chatSort, lineNumbers. The user's settings are now: theme light, code block line numbers on, chats sorted by title.",
    ],
    patched: {
      preferences: {
        chatSort: 'activity',
        hints: ['foo'],
        lineNumbers: false,
        theme: 'light',
      },
    },
  });
});

test('preferences saved before a setting existed get its default', async () => {
  const headers = await signIn();

  const { body } = await call(headers, 'GET', '/auth/get-session');

  await harness.commit(async (tx) => {
    const doc = await tx.doc(PreferencesDoc, body.user.id, null);

    Object.assign(doc, { theme: 'dark' });
    delete (doc as Partial<typeof doc>).lineNumbers;
  }, BACKGROUND_CONTEXT);

  expect((await call(headers, 'GET', '/preferences')).body).toEqual({
    preferences: {
      chatSort: 'activity',
      hints: [],
      lineNumbers: false,
      theme: 'dark',
    },
  });
});
