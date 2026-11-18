import { schema } from '@lab/db';
import type { HistoryAccess } from '@lab/harness';
import { and, asc, eq, isNull } from 'drizzle-orm';

import { db } from './db';
import { markedSnippet, searchMessages } from './message-search';
import { chatOf, conversationOwner } from './records';

const table = schema.messageText;

const SEARCH_LIMIT = 8;

export const historyAccess: HistoryAccess = {
  read: async (conversationId, id) => {
    const ownerId = await conversationOwner(conversationId);

    if (!ownerId) {
      return undefined;
    }

    const [chat] = await db
      .select({ title: schema.conversation.title })
      .from(schema.conversation)
      .where(
        and(
          eq(schema.conversation.id, id),
          eq(schema.conversation.ownerId, ownerId),
          isNull(schema.conversation.deletedAt)
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
    const chat = await chatOf(conversationId);

    if (!chat) {
      return [];
    }

    const matches = await searchMessages(chat.ownerId, query, {
      exclude: chat.id,
      limit: SEARCH_LIMIT,
    });

    return matches.map(({ id, snippet, title, updatedAt }) => ({
      id,
      snippet: markedSnippet(snippet),
      title,
      updatedAt,
    }));
  },
};
