import { bigint, char, index, integer, jsonb, pgTable, text, timestamp, unique, uniqueIndex, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './schema.js';
import { order } from './orders.js';

const id = () => bigint('id', { mode: 'number' }).generatedByDefaultAsIdentity().primaryKey();

// Intento de cobro de un pedido. El proveedor es un placeholder hasta definirlo.
export const payment = pgTable(
  'payment',
  {
    id: id(),
    orderId: bigint('order_id', { mode: 'number' })
      .notNull()
      .references(() => order.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    providerRef: text('provider_ref'),
    status: text('status').default('pending').notNull(), // pending | captured | failed | cancelled | partially_refunded | refunded
    amount: bigint('amount', { mode: 'number' }).notNull(),
    currency: char('currency', { length: 3 }).notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    unique('payment_order_idempotency_unique').on(t.orderId, t.idempotencyKey),
    // Un pedido solo puede tener un pago cobrado (aunque luego se reembolse).
    uniqueIndex('payment_one_captured_per_order').on(t.orderId).where(sql`${t.status} in ('captured', 'partially_refunded', 'refunded')`),
    uniqueIndex('payment_provider_ref_unique').on(t.provider, t.providerRef),
    index('payment_order_idx').on(t.orderId),
    check('payment_amount_positive', sql`${t.amount} > 0`),
  ],
);

// Eventos recibidos del proveedor; provider_event_id único para ignorar repeticiones.
export const paymentEvent = pgTable('payment_event', {
  id: id(),
  paymentId: bigint('payment_id', { mode: 'number' }).references(() => payment.id, { onDelete: 'set null' }),
  providerEventId: text('provider_event_id').notNull().unique(),
  type: text('type').notNull(),
  payload: jsonb('payload').notNull(),
  processedAt: timestamp('processed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const refund = pgTable(
  'refund',
  {
    id: id(),
    paymentId: bigint('payment_id', { mode: 'number' })
      .notNull()
      .references(() => payment.id, { onDelete: 'cascade' }),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    reason: text('reason'),
    status: text('status').default('succeeded').notNull(),
    providerRef: text('provider_ref'),
    createdBy: integer('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('refund_payment_idx').on(t.paymentId), check('refund_amount_positive', sql`${t.amount} > 0`)],
);
