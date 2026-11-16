import { index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { user } from './auth';

export const conversation = pgTable(
  'conversation',
  {
    id: integer('id').primaryKey(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    lastMessageAt: timestamp('last_message_at').defaultNow().notNull(),
    title: text('title'),
  },
  (table) => [
    index('conversation_ownerId_createdAt_idx').on(
      table.ownerId,
      table.createdAt
    ),
    index('conversation_ownerId_lastMessageAt_idx').on(
      table.ownerId,
      table.lastMessageAt
    ),
  ]
);

export const providerCredential = pgTable('provider_credential', {
  providerId: text('provider_id').primaryKey(),
  credential: text('credential').notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
