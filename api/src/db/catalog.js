import { bigint, boolean, check, index, integer, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { store } from './business.js';

// Catálogo de la sucursal. Dinero en unidades menores de la moneda de la sucursal.
const id = () => bigint('id', { mode: 'number' }).generatedByDefaultAsIdentity().primaryKey();
const ref = (name, table, onDelete = 'cascade') =>
  bigint(name, { mode: 'number' }).references(() => table.id, { onDelete });

// Categorías por sucursal, en árbol.
export const category = pgTable(
  'category',
  {
    id: id(),
    storeId: ref('store_id', store).notNull(),
    parentId: bigint('parent_id', { mode: 'number' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [unique('category_store_slug_unique').on(t.storeId, t.slug)],
);

export const item = pgTable(
  'item',
  {
    id: id(),
    storeId: ref('store_id', store).notNull(),
    categoryId: ref('category_id', category, 'set null'),
    sku: text('sku').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    priceAmount: bigint('price_amount', { mode: 'number' }).notNull(),
    currentStock: integer('current_stock').default(0).notNull(),
    status: text('status').default('draft').notNull(), // draft | active | inactive
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    unique('item_store_sku_unique').on(t.storeId, t.sku),
    check('item_price_nonneg', sql`${t.priceAmount} >= 0`),
    check('item_stock_nonneg', sql`${t.currentStock} >= 0`),
    // Listado público: orden por precio y búsqueda de texto (requiere la extensión pg_trgm, creada en la migración).
    index('item_public_price_idx')
      .on(t.priceAmount, t.id)
      .where(sql`${t.status} = 'active' and ${t.deletedAt} is null`),
    index('item_name_trgm_idx').using('gin', t.name.op('gin_trgm_ops')),
    index('item_description_trgm_idx').using('gin', t.description.op('gin_trgm_ops')),
    index('item_store_idx').on(t.storeId, t.id),
  ],
);

// Descuento de un ítem: percent (value en puntos base, 1000 = 10 %) o fixed (unidades menores).
export const itemDiscount = pgTable('item_discount', {
  id: id(),
  itemId: ref('item_id', item).notNull(),
  type: text('type').notNull(),
  value: bigint('value', { mode: 'number' }).notNull(),
  startsAt: timestamp('starts_at').notNull(),
  endsAt: timestamp('ends_at'),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const itemImage = pgTable(
  'item_image',
  {
    id: id(),
    itemId: ref('item_id', item).notNull(),
    path: text('path').notNull(), // relativo a la carpeta de subidas
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    position: integer('position').notNull(),
  },
  (t) => [unique('item_image_item_position_unique').on(t.itemId, t.position)],
);
