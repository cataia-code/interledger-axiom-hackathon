import { bigint, check, index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './schema.js';
import { item } from './catalog.js';
import { order } from './orders.js';

// Libro de movimientos de stock: solo inserciones. item.current_stock se actualiza en la misma transacción.
export const stockMovement = pgTable(
  'stock_movement',
  {
    id: bigint('id', { mode: 'number' }).generatedByDefaultAsIdentity().primaryKey(),
    itemId: bigint('item_id', { mode: 'number' })
      .notNull()
      .references(() => item.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // initial | restock | sale | cancel | adjustment
    quantityDelta: integer('quantity_delta').notNull(),
    stockAfter: integer('stock_after').notNull(),
    reason: text('reason'),
    orderId: bigint('order_id', { mode: 'number' }).references(() => order.id, { onDelete: 'set null' }),
    createdBy: integer('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('stock_movement_item_idx').on(t.itemId, t.id),
    check('stock_movement_delta_nonzero', sql`${t.quantityDelta} <> 0`),
    check('stock_movement_after_nonneg', sql`${t.stockAfter} >= 0`),
  ],
);

// Reserva temporal de stock mientras el pedido espera el pago.
export const stockReservation = pgTable(
  'stock_reservation',
  {
    id: bigint('id', { mode: 'number' }).generatedByDefaultAsIdentity().primaryKey(),
    itemId: bigint('item_id', { mode: 'number' })
      .notNull()
      .references(() => item.id, { onDelete: 'cascade' }),
    orderId: bigint('order_id', { mode: 'number' })
      .notNull()
      .references(() => order.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull(),
    status: text('status').default('active').notNull(), // active | confirmed | released | expired
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('stock_reservation_item_status_idx').on(t.itemId, t.status),
    index('stock_reservation_order_idx').on(t.orderId),
    check('stock_reservation_qty_positive', sql`${t.quantity} > 0`),
  ],
);
