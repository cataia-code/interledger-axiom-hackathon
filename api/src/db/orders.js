import { bigint, char, check, index, integer, numeric, pgTable, primaryKey, text, timestamp, uniqueIndex, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './schema.js';
import { store } from './business.js';
import { item } from './catalog.js';

const id = () => bigint('id', { mode: 'number' }).generatedByDefaultAsIdentity().primaryKey();

// Carrito del buyer: uno activo a la vez, de una sola sucursal.
export const cart = pgTable(
  'cart',
  {
    id: id(),
    userId: integer('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    status: text('status').default('active').notNull(), // active | converted
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [uniqueIndex('cart_one_active_per_user').on(t.userId).where(sql`${t.status} = 'active'`)],
);

export const cartItem = pgTable(
  'cart_item',
  {
    cartId: bigint('cart_id', { mode: 'number' })
      .notNull()
      .references(() => cart.id, { onDelete: 'cascade' }),
    itemId: bigint('item_id', { mode: 'number' })
      .notNull()
      .references(() => item.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull(),
    addedAt: timestamp('added_at').defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.cartId, t.itemId] }), check('cart_item_qty_positive', sql`${t.quantity} > 0`)],
);

// Pedido de un buyer a la sucursal. Importes en unidades menores de `currency`.
export const order = pgTable(
  'order',
  {
    id: id(),
    number: text('number').notNull().unique(),
    buyerId: integer('buyer_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    storeId: bigint('store_id', { mode: 'number' })
      .notNull()
      .references(() => store.id, { onDelete: 'cascade' }),
    status: text('status').default('pending_payment').notNull(), // pending_payment | paid | preparing | completed | cancelled | refunded
    subtotalAmount: bigint('subtotal_amount', { mode: 'number' }).notNull(), // precio original de las líneas
    discountAmount: bigint('discount_amount', { mode: 'number' }).notNull(),
    totalAmount: bigint('total_amount', { mode: 'number' }).notNull(),
    commissionRate: numeric('commission_rate', { precision: 6, scale: 5, mode: 'number' }).notNull(),
    commissionAmount: bigint('commission_amount', { mode: 'number' }).notNull(),
    currency: char('currency', { length: 3 }).notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    expiresAt: timestamp('expires_at').notNull(), // plazo para pagar
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    unique('order_buyer_idempotency_unique').on(t.buyerId, t.idempotencyKey),
    index('order_store_status_idx').on(t.storeId, t.status),
    index('order_buyer_idx').on(t.buyerId, t.id),
    check('order_total_matches', sql`${t.totalAmount} = ${t.subtotalAmount} - ${t.discountAmount}`),
  ],
);

// Líneas con nombre, SKU y precios congelados al comprar.
export const orderItem = pgTable(
  'order_item',
  {
    id: id(),
    orderId: bigint('order_id', { mode: 'number' })
      .notNull()
      .references(() => order.id, { onDelete: 'cascade' }),
    itemId: bigint('item_id', { mode: 'number' })
      .notNull()
      .references(() => item.id), // NO ACTION: el historial no se pierde por borrar el ítem
    nameSnapshot: text('name_snapshot').notNull(),
    skuSnapshot: text('sku_snapshot').notNull(),
    originalUnitAmount: bigint('original_unit_amount', { mode: 'number' }).notNull(),
    discountUnitAmount: bigint('discount_unit_amount', { mode: 'number' }).notNull(),
    unitAmount: bigint('unit_amount', { mode: 'number' }).notNull(),
    quantity: integer('quantity').notNull(),
    lineAmount: bigint('line_amount', { mode: 'number' }).notNull(),
  },
  (t) => [
    index('order_item_order_idx').on(t.orderId),
    check('order_item_qty_positive', sql`${t.quantity} > 0`),
    check('order_item_line_matches', sql`${t.lineAmount} = ${t.unitAmount} * ${t.quantity}`),
  ],
);

// Historial de estados: solo inserciones.
export const orderStatusHistory = pgTable(
  'order_status_history',
  {
    id: id(),
    orderId: bigint('order_id', { mode: 'number' })
      .notNull()
      .references(() => order.id, { onDelete: 'cascade' }),
    fromStatus: text('from_status'),
    toStatus: text('to_status').notNull(),
    actorId: integer('actor_id').references(() => user.id, { onDelete: 'set null' }), // null = sistema
    note: text('note'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('order_status_history_order_idx').on(t.orderId, t.id)],
);
