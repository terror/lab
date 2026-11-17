import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { ConversationId } from '@earendil-works/pi-durable';
import { schema } from '@lab/db';
import { and, eq, isNotNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { requireUser } from './auth';
import { db } from './db';
import { harness } from './harness';
import { removeChatFolder } from './sandbox';
import { validator } from './validator';

type Trashed = { deletedAt: Date; id: number; title: string | null };

type Trashable = {
  list: (ownerId: string) => Promise<Trashed[]>;
  purge: (ownerId: string, id: number) => Promise<boolean>;
  restore: (ownerId: string, id: number) => Promise<boolean>;
};

const table = schema.conversation;

function trashed(ownerId: string, id: number) {
  return and(
    eq(table.id, id),
    eq(table.ownerId, ownerId),
    isNotNull(table.deletedAt)
  );
}

const conversations: Trashable = {
  list: async (ownerId) => {
    const rows = await db
      .select({ deletedAt: table.deletedAt, id: table.id, title: table.title })
      .from(table)
      .where(and(eq(table.ownerId, ownerId), isNotNull(table.deletedAt)));

    return rows.flatMap(({ deletedAt, id, title }) =>
      deletedAt ? [{ deletedAt, id, title }] : []
    );
  },
  purge: async (ownerId, id) => {
    const [row] = await db
      .select({ id: table.id })
      .from(table)
      .where(trashed(ownerId, id));

    if (!row) {
      return false;
    }

    const conversation = await harness.conversation(
      id as ConversationId,
      BACKGROUND_CONTEXT
    );

    await conversation?.abort(BACKGROUND_CONTEXT);

    void removeChatFolder(ownerId, id).catch(console.error);

    await db.transaction(async (tx) => {
      await tx.delete(table).where(eq(table.id, id));

      await tx
        .insert(schema.conversationDeletion)
        .values({ id, ownerId })
        .onConflictDoNothing();
    });

    return true;
  },
  restore: async (ownerId, id) => {
    const restored = await db
      .update(table)
      .set({ deletedAt: null })
      .where(trashed(ownerId, id))
      .returning({ id: table.id });

    return restored.length > 0;
  },
};

const kinds = ['conversation'] as const;

const trashables: Record<(typeof kinds)[number], Trashable> = {
  conversation: conversations,
};

const params = validator(
  'param',
  z.object({
    id: z.coerce.number().int().positive(),
    kind: z.enum(kinds),
  })
);

async function items(ownerId: string) {
  const lists = await Promise.all(
    kinds.map(async (kind) =>
      (await trashables[kind].list(ownerId)).map((item) => ({ ...item, kind }))
    )
  );

  return lists
    .flat()
    .toSorted((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
}

function found(done: boolean) {
  if (!done) {
    throw new HTTPException(404, { message: 'Not in the trash' });
  }
}

const trash = new Hono()
  .use(requireUser)
  .get('/', async (c) =>
    c.json({
      items: (await items(c.get('user').id)).map(
        ({ deletedAt, id, kind, title }) => ({
          deletedAt: deletedAt.toISOString(),
          id,
          kind,
          title,
        })
      ),
    })
  )
  .post('/:kind/:id/restore', params, async (c) => {
    const { id, kind } = c.req.valid('param');

    found(await trashables[kind].restore(c.get('user').id, id));

    return c.body(null, 204);
  })
  .delete('/:kind/:id', params, async (c) => {
    const { id, kind } = c.req.valid('param');

    found(await trashables[kind].purge(c.get('user').id, id));

    return c.body(null, 204);
  })
  .delete('/', async (c) => {
    const ownerId = c.get('user').id;

    for (const { id, kind } of await items(ownerId)) {
      await trashables[kind].purge(ownerId, id);
    }

    return c.body(null, 204);
  });

export default trash;
