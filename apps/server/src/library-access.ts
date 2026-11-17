import { schema } from '@lab/db';
import type { LibraryAccess } from '@lab/harness';
import { and, desc, eq, isNull } from 'drizzle-orm';

import { db } from './db';
import { contains, owners } from './records';

const table = schema.libraryItem;

const SEARCH_LIMIT = 20;

async function owner(conversationId: number) {
  return (await owners([conversationId])).get(conversationId);
}

export const libraryAccess: LibraryAccess = {
  read: async (conversationId, id) => {
    const ownerId = await owner(conversationId);

    if (!ownerId) {
      return undefined;
    }

    const [item] = await db
      .select({
        content: table.content,
        kind: table.kind,
        mimeType: table.mimeType,
        name: table.name,
      })
      .from(table)
      .where(and(eq(table.id, id), eq(table.ownerId, ownerId)));

    if (!item) {
      return undefined;
    }

    const bytes = Buffer.from(item.content);

    if (item.kind === 'image') {
      return {
        data: bytes.toString('base64'),
        kind: 'image',
        mimeType: item.mimeType,
        name: item.name,
      };
    }

    return { kind: 'file', name: item.name, text: bytes.toString('utf8') };
  },
  search: async (conversationId, { kind, search }) => {
    const ownerId = await owner(conversationId);

    if (!ownerId) {
      return [];
    }

    const rows = await db
      .select({
        chat: schema.conversation.title,
        createdAt: table.createdAt,
        id: table.id,
        kind: table.kind,
        name: table.name,
        size: table.size,
      })
      .from(table)
      .leftJoin(
        schema.conversation,
        eq(schema.conversation.id, table.conversationId)
      )
      .where(
        and(
          eq(table.ownerId, ownerId),
          isNull(schema.conversation.deletedAt),
          kind === undefined ? undefined : eq(table.kind, kind),
          ...(search ?? '')
            .split(/[^\p{L}\p{N}]+/u)
            .filter(Boolean)
            .map((term) => contains(table.name, term))
        )
      )
      .orderBy(desc(table.createdAt), desc(table.id))
      .limit(SEARCH_LIMIT);

    return rows.map((row) => ({
      ...row,
      chat: row.chat ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  },
};
