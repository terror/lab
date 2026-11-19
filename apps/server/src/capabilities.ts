import { schema } from '@lab/db';
import { and, eq, isNotNull } from 'drizzle-orm';
import { Hono } from 'hono';

import { requireUser } from './auth';
import { db } from './db';
import { flushToolUse } from './tool-use';

const capabilities = new Hono().use(requireUser).get('/', async (c) => {
  const ownerId = c.get('user').id;

  await flushToolUse();

  const [used, saved, branched] = await Promise.all([
    db
      .select({ tool: schema.toolUse.tool })
      .from(schema.toolUse)
      .where(eq(schema.toolUse.ownerId, ownerId)),
    db
      .select({ key: schema.artifactState.key })
      .from(schema.artifactState)
      .where(eq(schema.artifactState.ownerId, ownerId))
      .limit(1),
    db
      .select({ id: schema.conversation.id })
      .from(schema.conversation)
      .where(
        and(
          eq(schema.conversation.ownerId, ownerId),
          isNotNull(schema.conversation.parentId)
        )
      )
      .limit(1),
  ]);

  const tools = new Set(used.map(({ tool }) => tool));

  return c.json({
    tried: {
      apps: saved.length > 0,
      branches: branched.length > 0,
      helpers: tools.has('delegate'),
      images: tools.has('image_generate'),
      plan: tools.has('plan_update'),
      schedules: tools.has('schedule_create'),
    },
  });
});

export default capabilities;
