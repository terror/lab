import {
  customType,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
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
    pinnedAt: timestamp('pinned_at'),
    archivedAt: timestamp('archived_at'),
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
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    entryId: integer('entry_id').unique(),
    kind: text('kind', { enum: ['compaction', 'response', 'status', 'title'] })
      .default('response')
      .notNull(),
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
    index('usage_event_conversationId_idx').on(table.conversationId),
    index('usage_event_ownerId_createdAt_idx').on(
      table.ownerId,
      table.createdAt
    ),
  ]
);

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType: () => 'bytea',
});

export const libraryItem = pgTable(
  'library_item',
  {
    id: integer('id').generatedAlwaysAsIdentity().notNull().unique(),
    entryId: integer('entry_id').notNull(),
    position: integer('position').notNull(),
    conversationId: integer('conversation_id')
      .notNull()
      .references(() => conversation.id, { onDelete: 'cascade' }),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['file', 'image'] }).notNull(),
    name: text('name').notNull(),
    mimeType: text('mime_type').notNull(),
    size: integer('size').notNull(),
    preview: text('preview'),
    content: bytea('content').notNull(),
    createdAt: timestamp('created_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.entryId, table.position] }),
    index('library_item_conversationId_idx').on(table.conversationId),
    index('library_item_ownerId_createdAt_idx').on(
      table.ownerId,
      table.createdAt
    ),
  ]
);

export const conversationDeletion = pgTable('conversation_deletion', {
  id: integer('id').primaryKey(),
  ownerId: text('owner_id').references(() => user.id, { onDelete: 'cascade' }),
  deletedAt: timestamp('deleted_at').defaultNow().notNull(),
});

export const spendBudget = pgTable('spend_budget', {
  ownerId: text('owner_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  monthlyLimit: doublePrecision('monthly_limit').notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const backfillCheckpoint = pgTable(
  'backfill_checkpoint',
  {
    pipeline: text('pipeline').notNull(),
    conversationId: integer('conversation_id')
      .notNull()
      .references(() => conversation.id, { onDelete: 'cascade' }),
    entryId: integer('entry_id').notNull(),
  },
  (table) => [primaryKey({ columns: [table.pipeline, table.conversationId] })]
);
