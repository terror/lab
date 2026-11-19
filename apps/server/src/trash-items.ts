import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import type { ConversationId } from '@earendil-works/pi-durable';
import { schema } from '@lab/db';
import { type TrashKind, trashKinds } from '@lab/harness';
import { and, eq, isNotNull, not, sql } from 'drizzle-orm';

import { db } from './db';
import { harness } from './harness';
import { restoreProject, trashProject } from './project-access';
import { liveChat } from './records';
import { removeChatFolder } from './sandbox';
import { pruneUploads } from './storage';

type Trashed = { deletedAt: Date; id: number; title: string | null };

type Trashable = {
  list: (ownerId: string) => Promise<Trashed[]>;
  purge: (ownerId: string, id: number) => Promise<number[] | undefined>;
  restore: (ownerId: string, id: number) => Promise<boolean>;
  trash: (ownerId: string, id: number) => Promise<number[] | undefined>;
};

const table = schema.conversation;

const projectTable = schema.project;

const deletion = schema.conversationDeletion;

const outsideTrashedProject = sql`not exists (select 1 from ${projectTable} where ${projectTable.id} = ${table.projectId} and ${projectTable.deletedAt} is not null)`;

const purged = sql`exists (select 1 from ${deletion} where ${deletion.id} = ${table.id})`;

type Reader = Pick<typeof db, 'select'>;

async function branched(reader: Reader, id: number) {
  const [branch] = await reader
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.parentId, id), isNotNull(table.parentEntryId)))
    .limit(1);

  return branch !== undefined;
}

function trashed(ownerId: string, id: number) {
  return and(
    eq(table.id, id),
    eq(table.ownerId, ownerId),
    isNotNull(table.deletedAt),
    outsideTrashedProject,
    not(purged)
  );
}

async function purgeChat(ownerId: string, id: number) {
  const conversation = await harness.conversation(
    id as ConversationId,
    BACKGROUND_CONTEXT
  );

  await conversation?.abort(BACKGROUND_CONTEXT);

  await removeChatFolder(ownerId, id);

  const { parent, released } = await db.transaction(async (tx) => {
    await tx.insert(deletion).values({ id, ownerId }).onConflictDoNothing();

    if (await branched(tx, id)) {
      await tx.update(table).set({ projectId: null }).where(eq(table.id, id));

      await tx
        .delete(schema.artifactState)
        .where(eq(schema.artifactState.conversationId, id));

      await tx
        .update(schema.scheduledTask)
        .set({ conversationId: null })
        .where(eq(schema.scheduledTask.conversationId, id));

      return { parent: undefined, released: [] };
    }

    const attached = await tx
      .select({ id: schema.libraryItem.uploadId })
      .from(schema.libraryItem)
      .where(eq(schema.libraryItem.conversationId, id));

    const [row] = await tx
      .delete(table)
      .where(eq(table.id, id))
      .returning({ entryId: table.parentEntryId, parentId: table.parentId });

    return {
      parent: row?.entryId === null ? undefined : row?.parentId,
      released: attached.flatMap((upload) => upload.id ?? []),
    };
  });

  await pruneUploads(ownerId, released).catch(console.error);

  if (
    typeof parent === 'number' &&
    (await db.$count(deletion, eq(deletion.id, parent))) > 0 &&
    !(await branched(db, parent))
  ) {
    await purgeChat(ownerId, parent);
  }
}

const conversations: Trashable = {
  trash: async (ownerId, id) => {
    const rows = await db
      .update(table)
      .set({ deletedAt: new Date() })
      .where(liveChat(ownerId, id))
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
          outsideTrashedProject,
          not(purged)
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

export function purgeFromTrash(kind: TrashKind, ownerId: string, id: number) {
  return trashables[kind].purge(ownerId, id);
}

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

export async function emptyTrash(ownerId: string) {
  const chats = new Array<number>();

  for (const { id, kind } of await listTrash(ownerId)) {
    chats.push(...((await purgeFromTrash(kind, ownerId, id)) ?? []));
  }

  return chats;
}
