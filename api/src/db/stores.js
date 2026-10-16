import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './schema.js';

// Tablas propias, separadas de schema.js porque ese archivo lo regenera Better Auth.
export const store = pgTable('store', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
