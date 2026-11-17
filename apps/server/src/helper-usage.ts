import type { AssistantMessage } from '@earendil-works/pi-ai';
import { schema } from '@lab/db';
import type { HelperKind } from '@lab/harness';

import { db } from './db';
import { conversationOwner, serial } from './records';

type UsageEvent = typeof schema.usageEvent.$inferInsert;

export function usageFields({
  model,
  provider,
  timestamp,
  usage,
}: AssistantMessage) {
  return {
    cacheRead: usage.cacheRead,
    cacheWrite: usage.cacheWrite,
    cost: usage.cost.total,
    createdAt: new Date(timestamp),
    input: usage.input,
    model,
    output: usage.output,
    provider,
  };
}

export async function recordUsage(
  conversationId: number,
  event: Omit<UsageEvent, 'conversationId' | 'ownerId'>
) {
  const ownerId = await conversationOwner(conversationId);

  if (ownerId) {
    await db
      .insert(schema.usageEvent)
      .values({ ...event, conversationId, ownerId });
  }
}

const queue = serial();

export function recordHelperUsage(
  conversationId: number,
  kind: HelperKind,
  message: AssistantMessage
) {
  queue.run(() =>
    recordUsage(conversationId, { ...usageFields(message), kind })
  );
}

export const flushHelperUsage = queue.flush;
