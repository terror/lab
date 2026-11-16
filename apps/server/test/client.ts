import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { ConversationId } from '@earendil-works/pi-durable';

import app from '../src/app';
import { harness } from '../src/harness';

export async function call(
  headers: Headers,
  method: string,
  path: string,
  body?: unknown
) {
  const response = await app.request(`/api${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      ...Object.fromEntries(headers),
      'content-type': 'application/json',
    },
    method,
  });

  const text = await response.text();

  return { body: text ? JSON.parse(text) : null, status: response.status };
}

export async function idle(id: number) {
  const conversation = await harness.conversation(
    id as ConversationId,
    BACKGROUND_CONTEXT
  );

  await conversation?.waitForIdle(BACKGROUND_CONTEXT);
}

export async function create(headers: Headers) {
  const { body } = await call(headers, 'POST', '/conversations', {
    content: 'foo',
  });

  await idle(body.id);

  return body.id as number;
}
