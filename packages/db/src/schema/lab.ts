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
