import { schema } from '@lab/db';
import { eq } from 'drizzle-orm';

import { db } from './db';

const table = schema.conversation;

export type Parent = { conversationId: number; entryId: number | null };

export type Segment = {
  cutoff: number | undefined;
  id: number;
  parent?: Parent;
};

export async function parentOf(id: number): Promise<Parent | undefined> {
  const [row] = await db
    .select({ entryId: table.parentEntryId, parentId: table.parentId })
    .from(table)
    .where(eq(table.id, id));

  if (!row || row.parentId === null) {
    return undefined;
  }

  return { conversationId: row.parentId, entryId: row.entryId };
}

export async function lineage(id: number, cutoff?: number): Promise<Segment[]> {
  const parent = await parentOf(id);

  const segment = { cutoff, id, parent };

  if (parent === undefined || parent.entryId === null) {
    return [segment];
  }

  return [segment, ...(await lineage(parent.conversationId, parent.entryId))];
}
