import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { schema } from '@lab/db';
import { expect, test } from 'bun:test';

import { signIn } from '../test/auth';
import { call, chat, settle, toolOutputs } from '../test/client';
import { prompts, script, toolCall } from '../test/models';
import { db } from './db';
import { env } from './env';
import { conversationOwner } from './records';

async function artifactChat(headers: Headers) {
  script(
    toolCall('artifact_create', {
      content: '<p>foo</p>',
      id: 'bar',
      title: 'Baz',
    }),
    fauxAssistantMessage('qux')
  );

  const id = await chat(headers, { content: 'foo' });

  return { id, state: `/conversations/${id}/artifacts/bar/state` };
}

test('artifact state is saved for its owner and read by the agent', async () => {
  const headers = await signIn();

  const { id, state } = await artifactChat(headers);

  await call(headers, 'PUT', `${state}?key=foo`, { value: '{"done":true}' });
  await call(headers, 'PUT', `${state}?key=bar`, { value: '1' });
  await call(headers, 'PUT', `${state}?key=bar`, { value: '2' });
  await call(headers, 'PUT', `${state}?key=baz`, { value: '3' });
  await call(headers, 'DELETE', `${state}?key=baz`);

  script(
    toolCall('artifact_state_read', { id: 'bar' }),
    toolCall('artifact_state_read', { id: 'qux' }),
    fauxAssistantMessage('done')
  );

  await call(headers, 'POST', `/conversations/${id}/messages`, {
    content: 'foo',
  });

  await settle(id);

  expect({
    agent: (await toolOutputs(headers, id)).slice(1),
    deleted: await call(headers, 'GET', `${state}?key=baz`),
    missing: await call(
      headers,
      'GET',
      `/conversations/${id}/artifacts/qux/state?key=foo`
    ),
    other: await call(await signIn(), 'GET', `${state}?key=bar`),
    prompt: prompts.at(-1)?.artifact_apps,
    saved: await call(headers, 'GET', `${state}?key=bar`),
  }).toEqual({
    agent: [
      '"Baz" (bar) saved:\n\nbar: 2\nfoo: {"done":true}',
      'No artifact has the id "qux".',
    ],
    deleted: { body: { value: null }, status: 200 },
    missing: { body: { error: 'Artifact not found' }, status: 404 },
    other: { body: { error: 'Conversation not found' }, status: 404 },
    prompt:
      '<artifact_apps>\nArtifacts can save data on the server that survives reloads; use it instead of localStorage, which artifacts cannot use. await lab.store.get(key) returns a saved JSON value or null, await lab.store.set(key, value) saves one, and await lab.store.delete(key) removes one, with up to 100 keys of up to 100,000 characters each per artifact. Use artifact_state_read to see what an artifact saved, for example to answer questions about what the user tracked in it.\n</artifact_apps>',
    saved: { body: { value: '2' }, status: 200 },
  });
});

test('artifact state stops at its key, length, and storage limits', async () => {
  const headers = await signIn();

  const { id, state } = await artifactChat(headers);

  const ownerId = (await conversationOwner(id)) ?? '';

  await db.insert(schema.artifactState).values(
    Array.from({ length: 100 }, (_, index) => ({
      artifactId: 'bar',
      conversationId: id,
      key: String(index),
      ownerId,
      value: '',
    }))
  );

  const save = (key: string, value: string) =>
    call(headers, 'PUT', `${state}?key=${key}`, { value });

  env.LAB_STORAGE_LIMIT = 0.000_5;

  try {
    expect({
      full: await save('foo', ''),
      grown: await save('0', 'x'.repeat(1_000)),
      long: await save('0', 'x'.repeat(100_001)),
      replaced: await save('0', 'foo'),
    }).toEqual({
      full: {
        body: { error: 'An artifact can save up to 100 keys.' },
        status: 400,
      },
      grown: {
        body: {
          error:
            'You’ve used your 0.0005 MB of storage. Delete chats with files and empty the Trash to free up space.',
        },
        status: 413,
      },
      long: {
        body: {
          error:
            '✖ Too big: expected string to have <=100000 characters\n  → at value',
        },
        status: 400,
      },
      replaced: { body: null, status: 204 },
    });
  } finally {
    env.LAB_STORAGE_LIMIT = undefined;
  }
});
