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

  const patched = await call(headers, 'PATCH', '/preferences', {
    personality: 'quiet',
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
    final: (await call(headers, 'GET', '/preferences')).body,
    initial: initial.body,
    invalid: invalid.status,
    outputs: await toolOutputs(headers, id),
    patched: patched.body,
  }).toEqual({
    final: {
      preferences: {
        chatSort: 'title',
        lineNumbers: true,
        personality: 'quiet',
        theme: 'light',
      },
    },
    initial: {
      preferences: {
        chatSort: 'activity',
        lineNumbers: false,
        personality: 'default',
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
        lineNumbers: false,
        personality: 'quiet',
        theme: 'light',
      },
    },
  });
});

test('stored preferences omit retired settings and fill missing defaults', async () => {
  const headers = await signIn();

  const { body } = await call(headers, 'GET', '/auth/get-session');

  await harness.commit(async (tx) => {
    const doc = await tx.doc(PreferencesDoc, body.user.id, null);

    Object.assign(doc, { hints: ['foo'], theme: 'dark' });
    delete (doc as Partial<typeof doc>).personality;
  }, BACKGROUND_CONTEXT);

  expect((await call(headers, 'GET', '/preferences')).body).toEqual({
    preferences: {
      chatSort: 'activity',
      lineNumbers: false,
      personality: 'default',
      theme: 'dark',
    },
  });
});
