import type { EntryRecord } from '@earendil-works/pi-durable';
import { schema } from '@lab/db';
import { z } from 'zod';

import { db } from './db';
import { backfill, entryChanges, observe } from './pipeline';
import { owners } from './records';

const table = schema.messageText;

const messageData = z.object({ text: z.string().default('') });

function messageText(entry: EntryRecord) {
  const message = entry.model?.[0];

  if (entry.kind === 'lab.message') {
    const content = messageData.safeParse(entry.data).data?.text.trim();

    return content ? { role: 'user' as const, text: content } : undefined;
  }

  if (message?.role !== 'assistant') {
    return undefined;
  }

  const content = message.content
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('\n\n')
    .trim();

  return content ? { role: 'assistant' as const, text: content } : undefined;
}

function searchable(entry: EntryRecord) {
  return messageText(entry) !== undefined;
}

async function record(entries: readonly EntryRecord[]) {
  const owned = await owners(
    entries.map(({ conversationId }) => conversationId)
  );

  const rows = entries.flatMap((entry) => {
    const ownerId = owned.get(entry.conversationId);

    const content = messageText(entry);

    if (!ownerId || !content) {
      return [];
    }

    return [
      {
        conversationId: entry.conversationId,
        createdAt: new Date(entry.model?.[0]?.timestamp ?? Date.now()),
        entryId: entry.id,
        ownerId,
        role: content.role,
        text: content.text,
      },
    ];
  });

  if (rows.length > 0) {
    await db.insert(table).values(rows).onConflictDoNothing();
  }
}

export const flushHistory = observe(
  (changes) => entryChanges(changes, searchable),
  record
);

export async function backfillHistory() {
  const conversations = await db
    .select({ id: schema.conversation.id })
    .from(schema.conversation);

  for (const { id } of conversations) {
    await backfill('history', id, (page) => record(page.filter(searchable)));
  }
}
