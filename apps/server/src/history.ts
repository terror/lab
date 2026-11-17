import type { EntryRecord } from '@earendil-works/pi-durable';
import { schema } from '@lab/db';

import { db } from './db';
import { isMessage, messageData } from './message-entry';
import { entryPipeline } from './pipeline';

const table = schema.messageText;

function messageText(entry: EntryRecord) {
  const message = entry.model?.[0];

  if (isMessage(entry)) {
    const content = messageData(entry)?.text.trim();

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

export const historyPipeline = entryPipeline({
  keep: searchable,
  name: 'history',
  rows: (entries, owned) =>
    entries.flatMap((entry) => {
      const ownerId = owned.get(entry.conversationId);

      const content = messageText(entry);

      return ownerId && content
        ? [
            {
              conversationId: entry.conversationId,
              createdAt: new Date(entry.model?.[0]?.timestamp ?? Date.now()),
              entryId: entry.id,
              ownerId,
              role: content.role,
              text: content.text,
            },
          ]
        : [];
    }),
  store: (rows) => db.insert(table).values(rows).onConflictDoNothing(),
});

export const flushHistory = historyPipeline.flush;
