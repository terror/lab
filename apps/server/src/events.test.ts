import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { ConversationId } from '@earendil-works/pi-durable';
import { expect, spyOn, test } from 'bun:test';

import { signIn } from '../test/auth';
import { create } from '../test/client';
import app from './app';
import { harness } from './harness';

test('closing the event stream right away stops the watch', async () => {
  const headers = await signIn();

  const id = await create(headers);

  const conversation = await harness.conversation(
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

  const original = harness.conversation.bind(harness);

  const lookup = spyOn(harness, 'conversation').mockImplementation(
    async (target, context) =>
      target === conversation.id ? conversation : original(target, context)
  );

  const response = await app.request(
    `/api/conversations/${id}/events`,
    { headers },
    { timeout: () => undefined }
  );

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
