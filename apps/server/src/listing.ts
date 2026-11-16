import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { schema } from '@lab/db';
import {
  type AnyColumn,
  type SQL,
  and,
  asc,
  desc,
  eq,
  isNotNull,
  isNull,
  sql,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { z } from 'zod';

import type { User } from './auth';
import { db } from './db';
import { harness } from './harness';
import { flushProjections } from './projections';
import { contains } from './records';
import { sortSchema } from './schemas';

export const listSchema = z.object({
  cursor: z.coerce.number().int().positive().optional(),
  filter: z
    .enum(['archived', 'pinned', 'recent', 'unarchived'])
    .default('unarchived'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().min(1).max(200).optional(),
  sort: sortSchema.default('activity'),
});

type Sort = z.infer<typeof sortSchema>;

type SortColumns = Record<'createdAt' | 'lastMessageAt' | 'title', AnyColumn>;

const sorts: Record<
  Sort,
  { ascending: boolean; keys: (columns: SortColumns) => SQL[] }
> = {
  activity: {
    ascending: false,
    keys: ({ lastMessageAt }) => [sql`${lastMessageAt}`],
  },
  created: { ascending: false, keys: ({ createdAt }) => [sql`${createdAt}`] },
  title: {
    ascending: true,
    keys: ({ title }) => [
      sql`${title} is null`,
      sql`lower(coalesce(${title}, ''))`,
    ],
  },
};

const filters = {
  archived: () => isNotNull(schema.conversation.archivedAt),
  pinned: () =>
    and(
      isNotNull(schema.conversation.pinnedAt),
      isNull(schema.conversation.archivedAt)
    ),
  recent: () =>
    and(
      isNull(schema.conversation.pinnedAt),
      isNull(schema.conversation.archivedAt)
    ),
  unarchived: () => isNull(schema.conversation.archivedAt),
};

function after(id: number, user: User, sort: Sort) {
  const { ascending, keys } = sorts[sort];

  const cursor = alias(schema.conversation, 'cursor');

  const position = db
    .select({ ...Object.fromEntries(keys(cursor).entries()), id: cursor.id })
    .from(cursor)
    .where(and(eq(cursor.id, id), eq(cursor.ownerId, user.id)));

  const columns = [
    ...keys(schema.conversation),
    sql`${schema.conversation.id}`,
  ];

  const row = sql`(${sql.join(columns, sql`, `)})`;

  return ascending ? sql`${row} > (${position})` : sql`${row} < (${position})`;
}

export async function running() {
  const { tasks } = await harness.inspect(BACKGROUND_CONTEXT);

  return new Set<number>(
    tasks
      .filter(({ record }) => !record.background)
      .map(({ record }) => record.conversationId)
  );
}

export async function listConversations(
  user: User,
  { cursor, filter, limit, search, sort }: z.infer<typeof listSchema>
) {
  await flushProjections();

  const { ascending, keys } = sorts[sort];

  const order = ascending ? asc : desc;

  const rows = await db
    .select({
      id: schema.conversation.id,
      pinnedAt: schema.conversation.pinnedAt,
      title: schema.conversation.title,
    })
    .from(schema.conversation)
    .where(
      and(
        eq(schema.conversation.ownerId, user.id),
        filters[filter](),
        cursor === undefined ? undefined : after(cursor, user, sort),
        search === undefined
          ? undefined
          : contains(schema.conversation.title, search)
      )
    )
    .orderBy(
      ...keys(schema.conversation).map((key) => order(key)),
      order(schema.conversation.id)
    )
    .limit(limit + 1);

  const page = rows.slice(0, limit);

  const next = rows.length > limit ? page.at(-1)?.id : undefined;

  const busy = await running();

  return {
    conversations: page.map(({ id, pinnedAt, title }) => ({
      id,
      pinned: pinnedAt !== null,
      running: busy.has(id),
      title,
    })),
    next: next ?? null,
  };
}
