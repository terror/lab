import type { AssistantMessage } from '@earendil-works/pi-ai';
import { schema } from '@lab/db';
import { eq } from 'drizzle-orm';

import { db } from './db';

async function record(
  conversationId: number,
  kind: 'status' | 'title',
  { model, provider, timestamp, usage }: AssistantMessage
) {
  const [owner] = await db
    .select({ ownerId: schema.conversation.ownerId })
    .from(schema.conversation)
    .where(eq(schema.conversation.id, conversationId));

  if (!owner) {
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
    ownerId: owner.ownerId,
    provider,
  });
}

let pending = Promise.resolve();

export function recordHelperUsage(
  conversationId: number,
  kind: 'status' | 'title',
  message: AssistantMessage
) {
  pending = pending.then(() =>
    record(conversationId, kind, message).catch(console.error)
  );
}

export function flushHelperUsage() {
  return pending;
}
