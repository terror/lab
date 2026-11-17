import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { ConversationId } from '@earendil-works/pi-durable';
import { schema } from '@lab/db';
import { type TrashKind, trashKinds } from '@lab/harness';
import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import { requireUser } from './auth';
import { db } from './db';
import { found } from './found';
import { harness } from './harness';
import { restoreProject, trashProject } from './project-access';
import { removeChatFolder } from './sandbox';
import { pruneUploads } from './storage';
import { positiveId, validator } from './validator';

type Trashed = { deletedAt: Date; id: number; title: string | null };

type Trashable = {
  list: (ownerId: string) => Promise<Trashed[]>;
  purge: (ownerId: string, id: number) => Promise<number[] | undefined>;
  restore: (ownerId: string, id: number) => Promise<boolean>;
  trash: (ownerId: string, id: number) => Promise<number[] | undefined>;
};

const table = schema.conversation;

const projectTable = schema.project;

const outsideTrashedProject = sql`not exists (select 1 from ${projectTable} where ${projectTable.id} = ${table.projectId} and ${projectTable.deletedAt} is not null)`;

function trashed(ownerId: string, id: number) {
  return and(
    eq(table.id, id),
    eq(table.ownerId, ownerId),
    isNotNull(table.deletedAt),
    outsideTrashedProject
  );
}

async function purgeChat(ownerId: string, id: number) {
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

  void pruneUploads(ownerId).catch(console.error);
}

const conversations: Trashable = {
  trash: async (ownerId, id) => {
    const rows = await db
      .update(table)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(table.id, id),
          eq(table.ownerId, ownerId),
          isNull(table.deletedAt)
        )
      )
      .returning({ id: table.id });

    return rows.length > 0 ? [id] : undefined;
  },
  list: async (ownerId) => {
    const rows = await db
      .select({ deletedAt: table.deletedAt, id: table.id, title: table.title })
      .from(table)
      .where(
        and(
          eq(table.ownerId, ownerId),
          isNotNull(table.deletedAt),
          outsideTrashedProject
        )
      );

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
      return undefined;
    }

    await purgeChat(ownerId, id);

    return [id];
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

function trashedProject(ownerId: string, id: number) {
  return and(
    eq(projectTable.id, id),
    eq(projectTable.ownerId, ownerId),
    isNotNull(projectTable.deletedAt)
  );
}

const projects: Trashable = {
  trash: trashProject,
  list: async (ownerId) => {
    const rows = await db
      .select({
        deletedAt: projectTable.deletedAt,
        id: projectTable.id,
        title: projectTable.name,
      })
      .from(projectTable)
      .where(
        and(
          eq(projectTable.ownerId, ownerId),
          isNotNull(projectTable.deletedAt)
        )
      );

    return rows.flatMap(({ deletedAt, id, title }) =>
      deletedAt ? [{ deletedAt, id, title }] : []
    );
  },
  purge: async (ownerId, id) => {
    const [row] = await db
      .select({ id: projectTable.id })
      .from(projectTable)
      .where(trashedProject(ownerId, id));

    if (!row) {
      return undefined;
    }

    const chats = await db
      .select({ id: table.id })
      .from(table)
      .where(eq(table.projectId, id))
      .orderBy(table.id);

    for (const chat of chats) {
      await purgeChat(ownerId, chat.id);
    }

    await db.delete(projectTable).where(eq(projectTable.id, id));

    return chats.map((chat) => chat.id);
  },
  restore: restoreProject,
};

const trashables: Record<TrashKind, Trashable> = {
  conversation: conversations,
  project: projects,
};

export async function moveToTrash(
  kind: TrashKind,
  ownerId: string,
  id: number,
  { running }: { running?: number } = {}
) {
  const chats = await trashables[kind].trash(ownerId, id);

  for (const chat of chats ?? []) {
    if (chat !== running) {
      const conversation = await harness.conversation(
        chat as ConversationId,
        BACKGROUND_CONTEXT
      );

      await conversation?.abort(BACKGROUND_CONTEXT);
    }
  }

  return chats !== undefined;
}

export function restoreFromTrash(kind: TrashKind, ownerId: string, id: number) {
  return trashables[kind].restore(ownerId, id);
}

export async function purgeFromTrash(
  kind: TrashKind,
  ownerId: string,
  id: number
) {
  return (await trashables[kind].purge(ownerId, id)) !== undefined;
}

const params = validator(
  'param',
  z.object({
    id: positiveId,
    kind: z.enum(trashKinds),
  })
);

export async function listTrash(ownerId: string) {
  const lists = await Promise.all(
    trashKinds.map(async (kind) =>
      (await trashables[kind].list(ownerId)).map((item) => ({ ...item, kind }))
    )
  );

  return lists
    .flat()
    .toSorted((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime())
    .map(({ deletedAt, id, kind, title }) => ({
      deletedAt: deletedAt.toISOString(),
      id,
      kind,
      title,
    }));
}

const trash = new Hono()
  .use(requireUser)
  .get('/', async (c) =>
    c.json({
      items: await listTrash(c.get('user').id),
    })
  )
  .post('/:kind/:id/restore', params, async (c) => {
    const { id, kind } = c.req.valid('param');

    found(
      await trashables[kind].restore(c.get('user').id, id),
      'Not in the trash'
    );

    return c.body(null, 204);
  })
  .delete('/:kind/:id', params, async (c) => {
    const { id, kind } = c.req.valid('param');

    const chats = found(
      await trashables[kind].purge(c.get('user').id, id),
      'Not in the trash'
    );

    return c.json({ chats });
  })
  .delete('/', async (c) => {
    const ownerId = c.get('user').id;

    const chats = new Array<number>();

    for (const { id, kind } of await listTrash(ownerId)) {
      chats.push(...((await trashables[kind].purge(ownerId, id)) ?? []));
    }

    return c.json({ chats });
  });

export default trash;
