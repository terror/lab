import type { AssistantMessage } from '@earendil-works/pi-ai';
import { schema } from '@lab/db';
import type { HelperKind } from '@lab/harness';

import { db } from './db';
import { conversationOwner, serial } from './records';

async function record(
  conversationId: number,
  kind: HelperKind,
  { model, provider, timestamp, usage }: AssistantMessage
) {
  const ownerId = await conversationOwner(conversationId);

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
  kind: HelperKind,
  message: AssistantMessage
) {
  queue.run(() => record(conversationId, kind, message));
}

export const flushHelperUsage = queue.flush;
