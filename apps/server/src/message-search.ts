import { schema } from '@lab/db';
import { sql } from 'drizzle-orm';

import { db } from './db';
import { storable } from './text';

const table = schema.messageText;

const START = '\u0001';

const STOP = '\u0002';

export type Segment = { match: boolean; text: string };

export type MessageMatch = {
  id: number;
  projectId: number | null;
  snippet: Segment[];
  title: string | null;
  updatedAt: string;
};

function segments(headline: string): Segment[] {
  return headline
    .split(START)
    .flatMap((part, index) => {
      if (index === 0) {
        return [{ match: false, text: part }];
      }

      const [matched = '', rest = ''] = part.split(STOP);

      return [
        { match: true, text: matched },
        { match: false, text: rest },
      ];
    })
    .map(({ match, text }) => ({ match, text: plain(text) }))
    .filter(({ text }) => text.length > 0);
}

export function plain(text: string) {
  return text.replace(/\*\*|__|`+|^#+\s+/gm, '');
}

export function markedSnippet(snippet: readonly Segment[]) {
  return snippet
    .map(({ match, text }) => (match ? `**${text}**` : text))
    .join('');
}

export async function searchMessages(
  ownerId: string,
  query: string,
  { exclude, limit }: { exclude?: number; limit: number }
): Promise<MessageMatch[]> {
  const anyWord = storable(query).trim().split(/\s+/).join(' or ');

  const terms = sql`websearch_to_tsquery('english', ${anyWord})`;

  const options = `MaxWords=24, MinWords=8, StartSel=${START}, StopSel=${STOP}`;

  const rows = await db.execute<{
    id: number;
    project_id: number | null;
    snippet: string;
    title: string | null;
    updated_at: string;
  }>(sql`
    select
      ${table.conversationId} as id,
      ${schema.conversation.title} as title,
      ${schema.conversation.projectId} as project_id,
      max(${table.createdAt})::text as updated_at,
      (array_agg(
        ts_headline('english', ${table.text}, ${terms}, ${options})
        order by ts_rank(${table.search}, ${terms}) desc
      ))[1] as snippet
    from ${table}
    join ${schema.conversation} on ${schema.conversation.id} = ${table.conversationId}
    where ${table.ownerId} = ${ownerId}
      and ${table.conversationId} <> ${exclude ?? 0}
      and ${schema.conversation.deletedAt} is null
      and ${table.search} @@ ${terms}
    group by ${table.conversationId}, ${schema.conversation.title}, ${schema.conversation.projectId}
    order by max(ts_rank(${table.search}, ${terms})) desc
    limit ${limit}
  `);

  return [...rows].map((row) => ({
    id: Number(row.id),
    projectId: row.project_id === null ? null : Number(row.project_id),
    snippet: segments(row.snippet),
    title: row.title,
    updatedAt: new Date(`${row.updated_at}+0000`).toISOString(),
  }));
}
