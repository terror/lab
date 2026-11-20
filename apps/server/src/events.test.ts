import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { ConversationId } from '@earendil-works/pi-durable';
import { expect, jest, spyOn, test } from 'bun:test';

import { signIn } from '../test/auth';
import { call, create, raw } from '../test/client';
import { auth } from './auth';
import { harness } from './harness';

test('closing the event stream right away stops the watch', async () => {
  const headers = await signIn();

  const id = await create(headers);

  const conversation = await harness().conversation(
    id as ConversationId,
    BACKGROUND_CONTEXT
  );

  if (!conversation) {
    throw new Error('missing conversation');
  }

  const watch = await conversation.watch(BACKGROUND_CONTEXT);

  const stop = spyOn(watch, 'stop');

  spyOn(conversation, 'watch').mockImplementation(async () => {
    await Bun.sleep(50);

    return watch;
  });

  const original = harness().conversation.bind(harness());

  const lookup = spyOn(harness(), 'conversation').mockImplementation(
    async (target, context) =>
      target === conversation.id ? conversation : original(target, context)
  );

  const response = await raw(headers, `/conversations/${id}/events`);

  await response.body?.cancel();

  for (
    let attempt = 0;
    attempt < 50 && stop.mock.calls.length === 0;
    attempt++
  ) {
    await Bun.sleep(10);
  }

  lookup.mockRestore();

  expect(stop).toHaveBeenCalledTimes(1);
});

async function follow(headers: Headers, id: number) {
  const response = await raw(headers, `/conversations/${id}/events`);

  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error('missing event stream');
  }

  await reader.read();

  return reader;
}

async function ended(reader: Awaited<ReturnType<typeof follow>>) {
  for (;;) {
    const next = await Promise.race([reader.read(), Bun.sleep(500)]);

    if (!next) {
      return false;
    }

    if (next.done) {
      return true;
    }
  }
}

test('opening more than 20 event streams closes the oldest', async () => {
  const headers = await signIn();

  const id = await create(headers);

  const oldest = await follow(headers, id);

  const next = await follow(headers, id);

  const rest = [];

  for (let index = 0; index < 19; index++) {
    rest.push(await follow(headers, id));
  }

  const closed = [await ended(oldest), await ended(next)];

  await Promise.all([oldest, next, ...rest].map((reader) => reader.cancel()));

  expect(closed).toEqual([true, false]);
});

async function watched(
  end: (headers: Headers, id: number) => Promise<unknown>
) {
  const headers = await signIn();

  const id = await create(headers);

  jest.useFakeTimers();

  const reader = await follow(headers, id);

  await end(headers, id);

  jest.advanceTimersByTime(25_000);

  jest.useRealTimers();

  const closed = await ended(reader);

  await reader.cancel();

  return closed;
}

test('event streams close once their session ends or their chat is trashed', async () => {
  expect({
    kept: await watched(async () => undefined),
    signedOut: await watched((headers) => auth.api.signOut({ headers })),
    trashed: await watched((headers, id) =>
      call(headers, 'DELETE', `/conversations/${id}`)
    ),
  }).toEqual({ kept: false, signedOut: true, trashed: true });
});
