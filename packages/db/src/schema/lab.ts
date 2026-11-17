import { sql } from 'drizzle-orm';
import {
  boolean,
  customType,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { user } from './auth';

export const project = pgTable(
  'project',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    instructions: text('instructions').notNull().default(''),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('project_ownerId_idx').on(table.ownerId)]
);

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
    deletedAt: timestamp('deleted_at'),
    projectId: integer('project_id').references(() => project.id),
  },
  (table) => [
    index('conversation_projectId_lastMessageAt_idx').on(
      table.projectId,
      table.lastMessageAt
    ),
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

export const upload = pgTable('upload', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: text('owner_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  mimeType: text('mime_type').notNull(),
  content: bytea('content').notNull(),
  thumbnail: bytea('thumbnail'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
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
    uploadId: uuid('upload_id').references(() => upload.id, {
      onDelete: 'set null',
    }),
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

const tsvector = customType<{ data: string }>({
  dataType: () => 'tsvector',
});

export const messageText = pgTable(
  'message_text',
  {
    entryId: integer('entry_id').primaryKey(),
    conversationId: integer('conversation_id')
      .notNull()
      .references(() => conversation.id, { onDelete: 'cascade' }),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['assistant', 'user'] }).notNull(),
    text: text('text').notNull(),
    createdAt: timestamp('created_at').notNull(),
    search: tsvector('search')
      .notNull()
      .generatedAlwaysAs(sql`to_tsvector('english', "text")`),
  },
  (table) => [
    index('message_text_search_idx').using('gin', table.search),
    index('message_text_conversationId_idx').on(
      table.conversationId,
      table.entryId
    ),
  ]
);

export const scheduledTask = pgTable(
  'scheduled_task',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    conversationId: integer('conversation_id').references(
      () => conversation.id,
      { onDelete: 'set null' }
    ),
    title: text('title').notNull(),
    prompt: text('prompt').notNull(),
    cron: text('cron').notNull(),
    timezone: text('timezone').notNull(),
    description: text('description').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    nextRunAt: timestamp('next_run_at'),
    lastRunAt: timestamp('last_run_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('scheduled_task_ownerId_idx').on(table.ownerId),
    index('scheduled_task_nextRunAt_idx').on(table.nextRunAt),
  ]
);
