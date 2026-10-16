import { bigint, char, integer, numeric, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './schema.js';

// Tablas propias, separadas de schema.js porque ese archivo lo regenera Better Auth.
// Ids numéricos (identity); las FK a `user` son integer porque así los genera Better Auth.

// Datos legales de la organización que representa a un usuario seller.
export const organization = pgTable('organization', {
  id: bigint('id', { mode: 'number' }).generatedByDefaultAsIdentity().primaryKey(),
  userId: integer('user_id')
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: 'cascade' }),
  legalName: text('legal_name').notNull(),
  tradeName: text('trade_name'),
  taxId: text('tax_id').notNull().unique(),
  legalId: text('legal_id').notNull().unique(),
  country: char('country', { length: 2 }).notNull(),
  legalAddress: text('legal_address').notNull(),
  phone: text('phone'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Sucursal de la organización. En el MVP hay una sola por organización.
export const store = pgTable('store', {
  id: bigint('id', { mode: 'number' }).generatedByDefaultAsIdentity().primaryKey(),
  organizationId: bigint('organization_id', { mode: 'number' })
    .notNull()
    .unique()
    .references(() => organization.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  address: text('address').notNull(),
  city: text('city').notNull(),
  phone: text('phone'),
  latitude: numeric('latitude', { precision: 9, scale: 6, mode: 'number' }).notNull(),
  longitude: numeric('longitude', { precision: 9, scale: 6, mode: 'number' }).notNull(),
  legalId: text('legal_id').notNull(),
  currency: char('currency', { length: 3 }).notNull(),
  status: text('status').default('active').notNull(), // active | paused | closed
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
