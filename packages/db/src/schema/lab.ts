import {
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

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

export const usageEvent = pgTable(
  'usage_event',
  {
    entryId: integer('entry_id').primaryKey(),
    conversationId: integer('conversation_id').notNull(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    createdAt: timestamp('created_at').notNull(),
    input: integer('input').notNull(),
    output: integer('output').notNull(),
    cacheRead: integer('cache_read').notNull(),
    cacheWrite: integer('cache_write').notNull(),
    cost: doublePrecision('cost').notNull(),
  },
  (table) => [
    index('usage_event_ownerId_createdAt_idx').on(
      table.ownerId,
      table.createdAt
    ),
  ]
);
