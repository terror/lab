import type { EntryRecord } from '@earendil-works/pi-durable';
import { schema } from '@lab/db';

import { db } from './db';
import { entryPipeline } from './pipeline';

const table = schema.toolUse;

function toolNames(entry: EntryRecord) {
  const message = entry.model?.[0];

  if (message?.role !== 'assistant') {
    return [];
  }

  return [
    ...new Set(
      message.content.flatMap((part) =>
        part.type === 'toolCall' ? [part.name] : []
      )
    ),
  ];
}

export const toolUsePipeline = entryPipeline({
  keep: (entry) => toolNames(entry).length > 0,
  name: 'tools',
  rows: (entries, owned) =>
    entries.flatMap((entry) => {
      const ownerId = owned.get(entry.conversationId);

      return ownerId
        ? toolNames(entry).map((tool) => ({
            conversationId: entry.conversationId,
            entryId: entry.id,
            ownerId,
            tool,
          }))
        : [];
    }),
  store: (rows) =>
    db
      .insert(table)
      .values(rows.map(({ ownerId, tool }) => ({ ownerId, tool })))
      .onConflictDoNothing(),
});

export const flushToolUse = toolUsePipeline.flush;
