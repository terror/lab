import { schema } from '@lab/db';
import type { HistoryAccess } from '@lab/harness';
import { and, asc, eq, sql } from 'drizzle-orm';

import { db } from './db';
import { owners } from './records';

const table = schema.messageText;

const SEARCH_LIMIT = 8;

async function owner(conversationId: number) {
  return (await owners([conversationId])).get(conversationId);
}

export const historyAccess: HistoryAccess = {
  read: async (conversationId, id) => {
    const ownerId = await owner(conversationId);

    if (!ownerId) {
      return undefined;
    }

    const [chat] = await db
      .select({ title: schema.conversation.title })
      .from(schema.conversation)
      .where(
        and(
          eq(schema.conversation.id, id),
          eq(schema.conversation.ownerId, ownerId)
        )
      );

    if (!chat) {
      return undefined;
    }

    const messages = await db
      .select({ role: table.role, text: table.text })
      .from(table)
      .where(eq(table.conversationId, id))
      .orderBy(asc(table.entryId));

    return {
      text: messages.map(({ role, text }) => `${role}: ${text}`).join('\n\n'),
      title: chat.title,
    };
  },
  search: async (conversationId, query) => {
    const ownerId = await owner(conversationId);

    if (!ownerId) {
      return [];
    }

    const anyWord = query.trim().split(/\s+/).join(' or ');

    const terms = sql`websearch_to_tsquery('english', ${anyWord})`;

    const rows = await db.execute<{
      id: number;
      snippet: string;
      title: string | null;
      updated_at: string;
    }>(sql`
      select
        ${table.conversationId} as id,
        ${schema.conversation.title} as title,
        max(${table.createdAt})::text as updated_at,
        (array_agg(
          ts_headline('english', ${table.text}, ${terms}, 'MaxWords=24, MinWords=8, StartSel=**, StopSel=**')
          order by ts_rank(${table.search}, ${terms}) desc
        ))[1] as snippet
      from ${table}
      join ${schema.conversation} on ${schema.conversation.id} = ${table.conversationId}
      where ${table.ownerId} = ${ownerId}
        and ${table.conversationId} <> ${conversationId}
        and ${schema.conversation.deletedAt} is null
        and ${table.search} @@ ${terms}
      group by ${table.conversationId}, ${schema.conversation.title}
      order by max(ts_rank(${table.search}, ${terms})) desc
      limit ${SEARCH_LIMIT}
    `);

    return [...rows].map(({ id, snippet, title, updated_at }) => ({
      id: Number(id),
      snippet,
      title,
      updatedAt: new Date(updated_at).toISOString(),
    }));
  },
};
