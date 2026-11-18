import { schema } from '@lab/db';
import { and, eq, gte, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';

import { db } from './db';
import { policy } from './policy';

const table = schema.usageEvent;

export async function monthSpend(ownerId: string) {
  const [month] = await db
    .select({ spent: sql`coalesce(sum(${table.cost}), 0)`.mapWith(Number) })
    .from(table)
    .where(
      and(
        eq(table.ownerId, ownerId),
        gte(table.createdAt, sql`date_trunc('month', now())`)
      )
    );

  return month?.spent ?? 0;
}

const dollars = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  style: 'currency',
});

export async function checkSpend(ownerId: string) {
  const limit = (await policy(ownerId)).spendLimit;

  if (limit !== undefined && (await monthSpend(ownerId)) >= limit) {
    throw new HTTPException(402, {
      message: `You’ve used this month’s ${dollars.format(limit)} limit`,
    });
  }
}
