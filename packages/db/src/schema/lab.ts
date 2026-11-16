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
  },
  (table) => [
    index('conversation_ownerId_createdAt_idx').on(
      table.ownerId,
      table.createdAt
    ),
  ]
);

export const invitation = pgTable('invitation', {
  email: text('email').primaryKey(),
  invitedById: text('invited_by_id').references(() => user.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
