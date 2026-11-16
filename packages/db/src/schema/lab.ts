import {
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

import { user } from './auth';

export const visibility = pgEnum('conversation_visibility', [
  'private',
  'shared',
  'family',
]);

export const conversation = pgTable(
  'conversation',
  {
    id: integer('id').primaryKey(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    visibility: visibility('visibility').default('private').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('conversation_ownerId_createdAt_idx').on(
      table.ownerId,
      table.createdAt
    ),
  ]
);

export const conversationMember = pgTable(
  'conversation_member',
  {
    conversationId: integer('conversation_id')
      .notNull()
      .references(() => conversation.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.conversationId, table.userId] }),
    index('conversation_member_userId_idx').on(table.userId),
  ]
);

export const invitation = pgTable('invitation', {
  email: text('email').primaryKey(),
  invitedById: text('invited_by_id').references(() => user.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
