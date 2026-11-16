import type { AssistantMessage } from '@earendil-works/pi-ai';
import { schema } from '@lab/db';

import { db } from './db';
import { owners, serial } from './records';

async function record(
  conversationId: number,
  kind: 'status' | 'title',
  { model, provider, timestamp, usage }: AssistantMessage
) {
  const ownerId = (await owners([conversationId])).get(conversationId);

  if (!ownerId) {
    return;
  }

  await db.insert(schema.usageEvent).values({
    cacheRead: usage.cacheRead,
    cacheWrite: usage.cacheWrite,
    conversationId,
    cost: usage.cost.total,
    createdAt: new Date(timestamp),
    input: usage.input,
    kind,
    model,
    output: usage.output,
    ownerId,
    provider,
  });
}

const queue = serial();

export function recordHelperUsage(
  conversationId: number,
  kind: 'status' | 'title',
  message: AssistantMessage
) {
  queue.run(() => record(conversationId, kind, message));
}

export const flushHelperUsage = queue.flush;
