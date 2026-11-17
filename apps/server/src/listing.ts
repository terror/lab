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
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import type { User } from './auth';
import { db } from './db';
import { harness } from './harness';
import { flushProjections } from './projections';
import { contains } from './records';
import { sortSchema } from './schemas';

export const listSchema = z.object({
  cursor: z.string().min(1).max(2_000).optional(),
  filter: z.enum(['all', 'pinned', 'recent']).default('all'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().min(1).max(200).optional(),
  sort: sortSchema.default('activity'),
});

type Sort = z.infer<typeof sortSchema>;

type SortColumns = Record<'createdAt' | 'lastMessageAt' | 'title', AnyColumn>;

const sorts: Record<
  Sort,
  {
    ascending: boolean;
    keys: (columns: SortColumns) => SQL[];
    types: string[];
  }
> = {
  activity: {
    ascending: false,
    keys: ({ lastMessageAt }) => [sql`${lastMessageAt}`],
    types: ['timestamp'],
  },
  created: {
    ascending: false,
    keys: ({ createdAt }) => [sql`${createdAt}`],
    types: ['timestamp'],
  },
  title: {
    ascending: true,
    keys: ({ title }) => [
      sql`${title} is null`,
      sql`lower(coalesce(${title}, ''))`,
    ],
    types: ['boolean', 'text'],
  },
};

const positionSchema = z.tuple([z.array(z.string()), z.number().int()]);

function encode(values: string[], id: number) {
  return Buffer.from(JSON.stringify([values, id])).toString('base64url');
}

function decode(cursor: string) {
  try {
    return positionSchema.parse(
      JSON.parse(Buffer.from(cursor, 'base64url').toString())
    );
  } catch {
    throw new HTTPException(400, { message: 'Invalid cursor' });
  }
}

const filters = {
  all: () => isNull(schema.conversation.deletedAt),
  pinned: () =>
    and(
      isNotNull(schema.conversation.pinnedAt),
      isNull(schema.conversation.deletedAt)
    ),
  recent: () =>
    and(
      isNull(schema.conversation.pinnedAt),
      isNull(schema.conversation.deletedAt)
    ),
};

function after(cursor: string, sort: Sort) {
  const { ascending, keys, types } = sorts[sort];

  const [values, id] = decode(cursor);

  if (values.length !== types.length) {
    throw new HTTPException(400, { message: 'Invalid cursor' });
  }

  const columns = [
    ...keys(schema.conversation),
    sql`${schema.conversation.id}`,
  ];

  const position = [
    ...values.map(
      (value, index) => sql`${value}::${sql.raw(types[index] ?? 'text')}`
    ),
    sql`${id}`,
  ];

  const row = sql`(${sql.join(columns, sql`, `)})`;

  const target = sql`(${sql.join(position, sql`, `)})`;

  return ascending ? sql`${row} > ${target}` : sql`${row} < ${target}`;
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

  const position = sql<string[]>`array[${sql.join(
    keys(schema.conversation).map((key) => sql`(${key})::text`),
    sql`, `
  )}]`;

  const rows = await db
    .select({
      id: schema.conversation.id,
      pinnedAt: schema.conversation.pinnedAt,
      position,
      title: schema.conversation.title,
    })
    .from(schema.conversation)
    .where(
      and(
        eq(schema.conversation.ownerId, user.id),
        filters[filter](),
        cursor === undefined ? undefined : after(cursor, sort),
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

  const last = page.at(-1);

  const next =
    last && rows.length > limit ? encode(last.position, last.id) : undefined;

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
