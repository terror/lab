import type { EntryRecord } from '@earendil-works/pi-durable';
import { schema } from '@lab/db';
import { and, desc, eq, gte, notExists, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import { requireUser } from './auth';
import { db } from './db';
import { flushHelperUsage } from './helper-usage';
import { models as catalog } from './models';
import { eachEntry, entryChanges, observe } from './pipeline';
import { owners } from './records';
import { validator } from './validator';

const table = schema.usageEvent;

function event(entry: EntryRecord, ownerId: string) {
  const message = entry.model?.[0];

  if (message?.role !== 'assistant') {
    return [];
  }

  const { usage } = message;

  return [
    {
      cacheRead: usage.cacheRead,
      cacheWrite: usage.cacheWrite,
      conversationId: entry.conversationId,
      cost: usage.cost.total,
      createdAt: new Date(message.timestamp),
      entryId: entry.id,
      input: usage.input,
      model: message.model,
      output: usage.output,
      ownerId,
      provider: message.provider,
    },
  ];
}

async function record(entries: readonly EntryRecord[]) {
  const owned = await owners(
    entries.map(({ conversationId }) => conversationId)
  );

  const rows = entries.flatMap((entry) => {
    const ownerId = owned.get(entry.conversationId);

    return ownerId ? event(entry, ownerId) : [];
  });

  if (rows.length > 0) {
    await db.insert(table).values(rows).onConflictDoNothing();
  }
}

function assistant(entry: EntryRecord) {
  return entry.model?.[0]?.role === 'assistant';
}

export const flushUsage = observe(
  (changes) => entryChanges(changes, assistant),
  record
);

export async function backfillUsage() {
  const missing = await db
    .select({ id: schema.conversation.id })
    .from(schema.conversation)
    .where(
      notExists(
        db
          .select()
          .from(table)
          .where(
            and(
              eq(table.conversationId, schema.conversation.id),
              eq(table.kind, 'response')
            )
          )
      )
    );

  for (const { id } of missing) {
    await eachEntry(id, (page) => record(page.filter(assistant)));
  }
}

const range = validator(
  'query',
  z.object({ days: z.coerce.number().int().min(1).max(365).default(30) })
);

function total<T>(expression: ReturnType<typeof sql<T>>) {
  return sql`coalesce(sum(${expression}), 0)`.mapWith(Number);
}

const usage = new Hono().use(requireUser).get('/', range, async (c) => {
  const user = c.get('user');

  const { days } = c.req.valid('query');

  await Promise.all([flushUsage(), flushHelperUsage()]);

  const since = sql`date_trunc('day', now()) - make_interval(days => ${days - 1})`;

  const scope = and(eq(table.ownerId, user.id), gte(table.createdAt, since));

  const totals = {
    cacheRead: total(sql`${table.cacheRead}`),
    cacheWrite: total(sql`${table.cacheWrite}`),
    cost: total(sql`${table.cost}`),
    input: total(sql`${table.input}`),
    output: total(sql`${table.output}`),
    responses: sql`count(*) filter (where ${table.kind} = 'response')`.mapWith(
      Number
    ),
  };

  const [summary] = await db.select(totals).from(table).where(scope);

  const daily = await db.execute<{
    cost: number;
    date: string;
    tokens: number;
  }>(
    sql`
      select
        to_char(day, 'YYYY-MM-DD') as date,
        coalesce(sum(${table.cost}), 0)::float8 as cost,
        coalesce(sum(${table.input} + ${table.output}), 0)::float8 as tokens
      from generate_series(${since}, date_trunc('day', now()), interval '1 day') as day
      left join ${table}
        on date_trunc('day', ${table.createdAt}) = day
        and ${table.ownerId} = ${user.id}
      group by day
      order by day
    `
  );

  const models = await db
    .select({
      cost: totals.cost,
      input: totals.input,
      model: table.model,
      output: totals.output,
      provider: table.provider,
      responses: totals.responses,
    })
    .from(table)
    .where(scope)
    .groupBy(table.provider, table.model)
    .orderBy(desc(totals.cost), table.provider, table.model);

  const conversations = await db
    .select({
      cost: totals.cost,
      id: table.conversationId,
      title: schema.conversation.title,
    })
    .from(table)
    .leftJoin(
      schema.conversation,
      eq(schema.conversation.id, table.conversationId)
    )
    .where(scope)
    .groupBy(table.conversationId, schema.conversation.title)
    .orderBy(desc(totals.cost))
    .limit(5);

  return c.json({
    conversations,
    daily: [...daily].map(({ cost, date, tokens }) => ({
      cost: Number(cost),
      date,
      tokens: Number(tokens),
    })),
    models: models.map((row) => ({
      ...row,
      name: catalog.getModel(row.provider, row.model)?.name ?? row.model,
    })),
    summary,
  });
});

export default usage;
