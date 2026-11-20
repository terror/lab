import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import {
  type ConversationId,
  LiveDoc,
  type LiveState,
} from '@earendil-works/pi-durable';
import { schema } from '@lab/db';
import { PlanDoc } from '@lab/harness';
import {
  type AnyColumn,
  type SQL,
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  sql,
} from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import type { User } from './auth';
import { db } from './db';
import { harness } from './harness';
import { flushHistory } from './history';
import { plain } from './message-search';
import { flushProjections } from './projections';
import { contains } from './records';
import { sortSchema } from './schemas';

export const listSchema = z.object({
  cursor: z.string().min(1).max(2_000).optional(),
  filter: z.enum(['all', 'pinned', 'recent']).default('all'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  project: z.coerce.number().int().positive().optional(),
  search: z.string().trim().min(1).max(200).optional(),
  sort: sortSchema.default('activity'),
});

type Sort = z.infer<typeof sortSchema>;

type SortColumns = Record<'createdAt' | 'lastMessageAt' | 'title', AnyColumn>;

function timestamp(value: string) {
  const iso = `${value.replace(' ', 'T')}Z`;

  const date = new Date(iso);

  return (
    /^(?!0000)\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?$/.test(value) &&
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 19) === iso.slice(0, 19)
  );
}

const valueTypes = {
  boolean: (value: string) => value === 'true' || value === 'false',
  text: (value: string) => !value.includes('\0'),
  timestamp,
};

type ValueType = keyof typeof valueTypes;

const sorts: Record<
  Sort,
  {
    ascending: boolean;
    keys: (columns: SortColumns) => SQL[];
    types: ValueType[];
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

const unreadColumn = sql<boolean>`coalesce(${schema.conversation.readAt} < ${schema.conversation.lastMessageAt}, true)`;

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
      isNull(schema.conversation.projectId),
      isNull(schema.conversation.deletedAt)
    ),
};

function after(cursor: string, sort: Sort) {
  const { ascending, keys, types } = sorts[sort];

  const [values, id] = decode(cursor);

  if (
    values.length !== types.length ||
    types.some((type, index) => !valueTypes[type](values[index] ?? ''))
  ) {
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

const approvalSchema = z.object({
  approval: z.object({
    action: z.string(),
    decision: z.never().optional(),
    summary: z.array(z.string()).default([]),
  }),
});

const questionSchema = z.object({
  options: z.array(z.string()),
  question: z.string(),
});

type Slot =
  | NonNullable<LiveState['nestedTools']>[number]
  | NonNullable<LiveState['tools']>[number];

function asksUser({ details, name, status }: Slot) {
  return (
    status === 'running' &&
    (name === 'ask_user' || approvalSchema.safeParse(details).success)
  );
}

function ask({ callId, details }: Slot) {
  const approval = approvalSchema.safeParse(details);

  if (approval.success) {
    const { action, summary } = approval.data.approval;

    return { action, callId, kind: 'approval' as const, summary };
  }

  const question = questionSchema.safeParse(details);

  return question.success
    ? { callId, kind: 'question' as const, ...question.data }
    : null;
}

function slots(live: LiveState | null | undefined): Slot[] {
  return [...(live?.tools ?? []), ...(live?.nestedTools ?? [])];
}

async function snapshots(ids: number[]) {
  const live = await Promise.all(
    ids.map((id) =>
      harness.snapshot(LiveDoc, id as ConversationId, BACKGROUND_CONTEXT)
    )
  );

  return new Map(ids.map((id, index) => [id, slots(live[index])]));
}

async function waiting(ids: number[]) {
  const live = await snapshots(ids);

  return new Set(ids.filter((id) => live.get(id)?.some(asksUser)));
}

export async function awaited(id: number, callId: string) {
  const live = await snapshots([id]);

  return (live.get(id) ?? []).some(
    (slot) => slot.callId === callId && slot.status !== 'done'
  );
}

function planStep(steps: readonly { status: string; text: string }[]) {
  const at = steps.findIndex(({ status }) => status !== 'done');

  const step = steps[at];

  return step ? { count: steps.length, index: at + 1, label: step.text } : null;
}

export async function listConversations(
  user: User,
  { cursor, filter, limit, project, search, sort }: z.infer<typeof listSchema>
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
      projectId: schema.conversation.projectId,
      title: schema.conversation.title,
      unread: unreadColumn,
    })
    .from(schema.conversation)
    .where(
      and(
        eq(schema.conversation.ownerId, user.id),
        filters[filter](),
        project === undefined
          ? undefined
          : eq(schema.conversation.projectId, project),
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

  const asking = await waiting(
    page.filter(({ id }) => busy.has(id)).map(({ id }) => id)
  );

  return {
    conversations: page.map(({ id, pinnedAt, projectId, title, unread }) => ({
      id,
      pinned: pinnedAt !== null,
      projectId,
      running: busy.has(id),
      title,
      unread: unread && !busy.has(id),
      waiting: asking.has(id),
    })),
    next: next ?? null,
  };
}

const PREVIEW_LENGTH = 280;

export async function listUnread(user: User) {
  await Promise.all([flushProjections(), flushHistory()]);

  const table = schema.conversation;

  const owned = and(eq(table.ownerId, user.id), isNull(table.deletedAt));

  const [rows, active] = await Promise.all([
    db
      .select({
        finishedAt: table.lastMessageAt,
        id: table.id,
        title: table.title,
      })
      .from(table)
      .where(
        and(
          owned,
          unreadColumn,
          gt(table.lastMessageAt, sql`now() - interval '24 hours'`)
        )
      )
      .orderBy(desc(table.lastMessageAt), desc(table.id))
      .limit(50),
    db
      .select({ id: table.id, title: table.title })
      .from(table)
      .where(and(owned, inArray(table.id, [...(await running())])))
      .orderBy(desc(table.lastMessageAt), desc(table.id)),
  ]);

  const busy = new Set(active.map(({ id }) => id));

  const live = await snapshots([...busy]);

  const asking = active.filter(({ id }) => live.get(id)?.some(asksUser));

  const going = active.filter(({ id }) => !live.get(id)?.some(asksUser));

  const finished = rows.filter(({ id }) => !busy.has(id));

  const ids = finished.map(({ id }) => id);

  const goingIds = going.map(({ id }) => id);

  const text = schema.messageText;

  const task = schema.scheduledTask;

  const [previews, scheduled, starts, plans] = await Promise.all([
    db
      .selectDistinctOn([text.conversationId], {
        id: text.conversationId,
        preview: sql<string>`left(${text.text}, ${PREVIEW_LENGTH})`,
      })
      .from(text)
      .where(and(inArray(text.conversationId, ids), eq(text.role, 'assistant')))
      .orderBy(text.conversationId, desc(text.entryId)),
    db
      .select({ id: task.conversationId })
      .from(task)
      .where(inArray(task.conversationId, ids)),
    db
      .selectDistinctOn([text.conversationId], {
        id: text.conversationId,
        startedAt: text.createdAt,
      })
      .from(text)
      .where(and(inArray(text.conversationId, goingIds), eq(text.role, 'user')))
      .orderBy(text.conversationId, desc(text.entryId)),
    Promise.all(
      goingIds.map((id) =>
        harness.snapshot(PlanDoc, id as ConversationId, BACKGROUND_CONTEXT)
      )
    ),
  ]);

  const texts = new Map(previews.map(({ id, preview }) => [id, preview]));

  const tasks = new Set(scheduled.map(({ id }) => id));

  const started = new Map(starts.map(({ id, startedAt }) => [id, startedAt]));

  return {
    chats: finished.map(({ finishedAt, id, title }) => ({
      finishedAt: finishedAt.toISOString(),
      id,
      preview: plain(texts.get(id) ?? ''),
      scheduled: tasks.has(id),
      title,
    })),
    runs: going.map(({ id, title }, index) => ({
      id,
      startedAt: started.get(id)?.toISOString() ?? null,
      step: planStep(plans[index]?.steps ?? []),
      title,
      tool:
        (live.get(id) ?? []).filter(({ status }) => status === 'running').at(-1)
          ?.name ?? null,
    })),
    waiting: asking.map(({ id, title }) => ({
      ask: (live.get(id) ?? []).filter(asksUser).map(ask).at(0) ?? null,
      id,
      title,
    })),
  };
}
