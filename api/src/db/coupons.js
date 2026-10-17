import { bigint, check, index, integer, pgTable, primaryKey, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './schema.js';
import { store } from './business.js';
import { item } from './catalog.js';
import { order } from './orders.js';

// Cupones de una sucursal. Importes en unidades menores de la moneda de la sucursal.
const id = () => bigint('id', { mode: 'number' }).generatedByDefaultAsIdentity().primaryKey();

export const coupon = pgTable(
  'coupon',
  {
    id: id(),
    storeId: bigint('store_id', { mode: 'number' })
      .notNull()
      .references(() => store.id, { onDelete: 'cascade' }),
    code: text('code'), // opcional, en mayúsculas; sirve para compartir un cupón público fuera de la app
    title: text('title').notNull(),
    description: text('description'),
    type: text('type').notNull(), // percent (value en puntos base, 1000 = 10 %) | fixed (value en unidades menores)
    value: bigint('value', { mode: 'number' }).notNull(),
    maxDiscountAmount: bigint('max_discount_amount', { mode: 'number' }), // tope del descuento (solo percent)
    minSubtotalAmount: bigint('min_subtotal_amount', { mode: 'number' }).default(0).notNull(),
    startsAt: timestamp('starts_at').defaultNow().notNull(),
    endsAt: timestamp('ends_at'),
    maxRedemptions: integer('max_redemptions'), // usos totales; null = sin límite
    perUserLimit: integer('per_user_limit').default(1).notNull(),
    audience: text('audience').default('assigned').notNull(), // assigned (solo quien lo recibe) | public (cualquiera lo puede guardar)
    status: text('status').default('active').notNull(), // active | paused
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('coupon_store_code_unique')
      .on(t.storeId, sql`lower(${t.code})`)
      .where(sql`${t.code} is not null and ${t.deletedAt} is null`),
    index('coupon_store_idx').on(t.storeId, t.id),
    check('coupon_value_positive', sql`${t.value} > 0`),
    check('coupon_percent_range', sql`${t.type} <> 'percent' or ${t.value} <= 9000`),
    check('coupon_limits_positive', sql`${t.perUserLimit} >= 1 and (${t.maxRedemptions} is null or ${t.maxRedemptions} >= 1)`),
  ],
);

// Productos a los que aplica el cupón. Sin filas = toda la tienda.
export const couponItem = pgTable(
  'coupon_item',
  {
    couponId: bigint('coupon_id', { mode: 'number' })
      .notNull()
      .references(() => coupon.id, { onDelete: 'cascade' }),
    itemId: bigint('item_id', { mode: 'number' })
      .notNull()
      .references(() => item.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.couponId, t.itemId] })],
);

// Quién tiene el cupón: asignado por el vendedor o guardado por el comprador.
export const couponWallet = pgTable(
  'coupon_wallet',
  {
    couponId: bigint('coupon_id', { mode: 'number' })
      .notNull()
      .references(() => coupon.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    source: text('source').notNull(), // assigned | claimed
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.couponId, t.userId] }), index('coupon_wallet_user_idx').on(t.userId)],
);

// Cada uso del cupón en un pedido. `reserved` cuenta como uso; `released` (pedido cancelado o vencido) lo devuelve.
export const couponRedemption = pgTable(
  'coupon_redemption',
  {
    id: id(),
    couponId: bigint('coupon_id', { mode: 'number' })
      .notNull()
      .references(() => coupon.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    orderId: bigint('order_id', { mode: 'number' })
      .notNull()
      .unique() // un cupón por pedido
      .references(() => order.id, { onDelete: 'cascade' }),
    discountAmount: bigint('discount_amount', { mode: 'number' }).notNull(),
    status: text('status').default('reserved').notNull(), // reserved | released
    createdAt: timestamp('created_at').defaultNow().notNull(),
    releasedAt: timestamp('released_at'),
  },
  (t) => [
    index('coupon_redemption_coupon_idx').on(t.couponId, t.status),
    index('coupon_redemption_user_idx').on(t.couponId, t.userId, t.status),
    check('coupon_redemption_amount_positive', sql`${t.discountAmount} > 0`),
  ],
);
