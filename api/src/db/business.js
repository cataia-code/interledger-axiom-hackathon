import { pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { user } from './schema.js';

// Tablas propias, separadas de schema.js porque ese archivo lo regenera Better Auth.

// Datos legales de la organización que representa a un usuario seller.
export const organization = pgTable('organization', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: 'cascade' }),
  legalName: text('legal_name').notNull(),
  tradeName: text('trade_name'),
  taxId: text('tax_id').notNull().unique(),
  country: text('country').notNull(),
  legalAddress: text('legal_address').notNull(),
  phone: text('phone'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Sucursal de una organización.
export const store = pgTable(
  'store',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    address: text('address').notNull(),
    city: text('city').notNull(),
    phone: text('phone'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [unique('store_organization_name_unique').on(table.organizationId, table.name)],
);
