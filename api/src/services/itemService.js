import { and, asc, desc, eq, ilike, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { store } from '../db/business.js';
import { category, item, itemDiscount, itemImage } from '../db/catalog.js';
import { HttpError } from '../middlewares/errorHandler.js';
import { bad, integer, object, optional, parseId, required } from './validation.js';
import { applyStockMovement, reservedByItem } from './stockService.js';
import { currentDiscounts, discountAmount, finalPrice, isDiscountCurrent } from './pricingService.js';

export const ITEM_STATUSES = ['draft', 'active', 'inactive'];
const MAX_PRICE = 1_000_000_000_000;

// ---------- presentación ----------
export const presentImage = (i) => ({
  id: i.id,
  url: `/uploads/${i.path}`,
  width: i.width,
  height: i.height,
  position: i.position,
});

export const presentDiscount = (d) => ({
  id: d.id,
  type: d.type,
  value: d.value,
  startsAt: d.startsAt,
  endsAt: d.endsAt,
  active: d.active,
});

// `discount` es el descuento vigente (o undefined); `own` añade datos solo para el seller.
export function presentItem(row, { currency, discount, images = [], own = false, reserved = 0 }) {
  const out = {
    id: row.id,
    storeId: row.storeId,
    categoryId: row.categoryId,
    sku: row.sku,
    name: row.name,
    description: row.description,
    priceAmount: row.priceAmount,
    currency,
    discount: discount ? presentDiscount(discount) : null,
    discountAmount: discountAmount(row.priceAmount, discount),
    finalPriceAmount: finalPrice(row.priceAmount, discount),
    available: row.currentStock - reserved,
    images: images.map(presentImage),
    createdAt: row.createdAt,
  };
  if (own) {
    out.currentStock = row.currentStock;
    out.reserved = reserved;
    out.status = row.status;
    out.updatedAt = row.updatedAt;
  }
  return out;
}

// ---------- validación ----------
function parseItem(input) {
  const b = object(input);
  const status = b.status ?? 'draft';
  if (!ITEM_STATUSES.includes(status)) throw bad('status must be draft, active or inactive', 'INVALID_STATUS');
  let categoryId = null;
  if (b.categoryId != null) categoryId = integer(b.categoryId, 'categoryId', 1, Number.MAX_SAFE_INTEGER, 'INVALID_CATEGORY');
  return {
    sku: required(b.sku, 'sku', 1, 40, 'INVALID_SKU'),
    name: required(b.name, 'name', 2, 120, 'INVALID_NAME'),
    description: optional(b.description, 'description', 2000, 'INVALID_DESCRIPTION'),
    priceAmount: integer(b.priceAmount, 'priceAmount', 0, MAX_PRICE, 'INVALID_PRICE'),
    categoryId,
    status,
  };
}

async function checkCategory(storeId, categoryId) {
  if (categoryId == null) return;
  const [row] = await db.select({ storeId: category.storeId }).from(category).where(eq(category.id, categoryId));
  if (!row || row.storeId !== storeId) throw bad('categoryId must be a category of this store', 'INVALID_CATEGORY');
}

const conflict = (error) => {
  const err = error.cause ?? error;
  return err.code === '23505' && err.constraint?.includes('item_store_sku')
    ? new HttpError(409, 'The store already has an item with that SKU', 'SKU_ALREADY_EXISTS')
    : error;
};

// ---------- ítems del seller ----------
export async function findOwnItem(storeId, idParam) {
  const id = parseId(idParam, 'Item not found', 'ITEM_NOT_FOUND');
  const [row] = await db.select().from(item).where(and(eq(item.id, id), isNull(item.deletedAt)));
  if (!row) throw new HttpError(404, 'Item not found', 'ITEM_NOT_FOUND');
  if (row.storeId !== storeId) throw new HttpError(403, 'That item belongs to another store', 'FORBIDDEN');
  return row;
}

export async function createItem(storeId, body, userId) {
  const input = parseItem(body);
  const initialStock = object(body).initialStock === undefined ? 0 : integer(body.initialStock, 'initialStock', 0, 1_000_000, 'INVALID_STOCK');
  await checkCategory(storeId, input.categoryId);
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx.insert(item).values({ storeId, ...input }).returning();
      if (initialStock > 0) {
        await applyStockMovement(tx, { itemId: row.id, type: 'initial', delta: initialStock, reason: 'Stock inicial', createdBy: Number(userId) });
      }
      return row;
    });
  } catch (err) {
    throw conflict(err);
  }
}

const EDITABLE = ['sku', 'name', 'description', 'priceAmount', 'categoryId', 'status'];
export async function updateItem(storeId, idParam, body) {
  const current = await findOwnItem(storeId, idParam);
  const b = object(body);
  const keys = EDITABLE.filter((k) => b[k] !== undefined);
  if (keys.length === 0) throw bad('Nothing to update', 'EMPTY_UPDATE');
  const merged = parseItem({ ...Object.fromEntries(EDITABLE.map((k) => [k, current[k]])), ...Object.fromEntries(keys.map((k) => [k, b[k]])) });
  if (keys.includes('categoryId')) await checkCategory(storeId, merged.categoryId);
  try {
    const [row] = await db.update(item).set(Object.fromEntries(keys.map((k) => [k, merged[k]]))).where(eq(item.id, current.id)).returning();
    return row;
  } catch (err) {
    throw conflict(err);
  }
}

// Borrado lógico: los pedidos conservan su copia del ítem.
export async function deleteItem(storeId, idParam) {
  const current = await findOwnItem(storeId, idParam);
  await db.update(item).set({ deletedAt: new Date(), status: 'inactive' }).where(eq(item.id, current.id));
}

async function imagesOf(itemIds) {
  const map = new Map();
  if (itemIds.length === 0) return map;
  const rows = await db.select().from(itemImage).where(inArray(itemImage.itemId, itemIds)).orderBy(asc(itemImage.position));
  for (const r of rows) map.set(r.itemId, [...(map.get(r.itemId) ?? []), r]);
  return map;
}

// Detalle de un ítem propio con imágenes y todos sus descuentos.
export async function ownItemDetail(storeId, idParam, currency) {
  const row = await findOwnItem(storeId, idParam);
  const [images, discounts, reserved] = await Promise.all([
    imagesOf([row.id]),
    db.select().from(itemDiscount).where(eq(itemDiscount.itemId, row.id)).orderBy(desc(itemDiscount.startsAt)),
    reservedByItem([row.id]),
  ]);
  const current = discounts.find((d) => isDiscountCurrent(d));
  return { ...presentItem(row, { currency, discount: current, images: images.get(row.id), own: true, reserved: reserved.get(row.id) }), discounts: discounts.map(presentDiscount) };
}

// ---------- paginación por cursor ----------
const encode = (parts) => Buffer.from(JSON.stringify(parts)).toString('base64url');
function decode(cursor) {
  if (cursor == null || cursor === '') return null;
  try {
    const parts = JSON.parse(Buffer.from(String(cursor), 'base64url').toString());
    if (Array.isArray(parts) && parts.every(Number.isSafeInteger)) return parts;
  } catch {
    // cae al error de abajo
  }
  throw bad('cursor is not valid', 'INVALID_CURSOR');
}
const pageSize = (v) => (v === undefined ? 20 : integer(v, 'limit', 1, 50, 'INVALID_LIMIT'));

async function decorate(rows, currencyOf, own) {
  const ids = rows.map((r) => r.id);
  const [discounts, images, reserved] = await Promise.all([currentDiscounts(ids), imagesOf(ids), reservedByItem(ids)]);
  return rows.map((r) =>
    presentItem(r, { currency: currencyOf(r), discount: discounts.get(r.id), images: images.get(r.id), own, reserved: reserved.get(r.id) }),
  );
}

export async function listOwnItems(storeId, currency, query) {
  const limit = pageSize(query.limit);
  const cursor = decode(query.cursor);
  const where = [eq(item.storeId, storeId), isNull(item.deletedAt)];
  if (query.status !== undefined) {
    if (!ITEM_STATUSES.includes(query.status)) throw bad('status must be draft, active or inactive', 'INVALID_STATUS');
    where.push(eq(item.status, query.status));
  }
  if (cursor) where.push(lt(item.id, cursor[0]));
  const rows = await db.select().from(item).where(and(...where)).orderBy(desc(item.id)).limit(limit + 1);
  const page = rows.slice(0, limit);
  return { items: await decorate(page, () => currency, true), nextCursor: rows.length > limit ? encode([page.at(-1).id]) : null };
}

// ---------- vista pública ----------
const SORTS = ['newest', 'price_asc', 'price_desc'];
const publicWhere = [eq(item.status, 'active'), isNull(item.deletedAt), eq(store.status, 'active'), isNull(store.deletedAt)];

export async function listPublicItems(query) {
  const limit = pageSize(query.limit);
  const sort = query.sort ?? 'newest';
  if (!SORTS.includes(sort)) throw bad(`sort must be one of ${SORTS.join(', ')}`, 'INVALID_SORT');
  const cursor = decode(query.cursor);
  const where = [...publicWhere];
  if (query.categoryId !== undefined) where.push(eq(item.categoryId, integer(query.categoryId, 'categoryId', 1, Number.MAX_SAFE_INTEGER, 'INVALID_CATEGORY')));
  if (query.storeId !== undefined) where.push(eq(item.storeId, integer(query.storeId, 'storeId', 1, Number.MAX_SAFE_INTEGER, 'INVALID_STORE')));
  if (query.q !== undefined) {
    const q = String(query.q).trim();
    if (q.length > 80) throw bad('q must be at most 80 characters', 'INVALID_QUERY');
    if (q) {
      const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
      where.push(or(ilike(item.name, like), ilike(item.description, like)));
    }
  }
  let order;
  if (sort === 'newest') {
    order = [desc(item.id)];
    if (cursor) where.push(lt(item.id, cursor[0]));
  } else if (sort === 'price_asc') {
    order = [asc(item.priceAmount), asc(item.id)];
    if (cursor) where.push(sql`(${item.priceAmount}, ${item.id}) > (${cursor[0]}, ${cursor[1]})`);
  } else {
    order = [desc(item.priceAmount), desc(item.id)];
    if (cursor) where.push(sql`(${item.priceAmount}, ${item.id}) < (${cursor[0]}, ${cursor[1]})`);
  }
  const rows = await db
    .select({ item, currency: store.currency })
    .from(item)
    .innerJoin(store, eq(store.id, item.storeId))
    .where(and(...where))
    .orderBy(...order)
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const currencies = new Map(page.map((r) => [r.item.id, r.currency]));
  const items = await decorate(page.map((r) => r.item), (r) => currencies.get(r.id), false);
  const last = page.at(-1)?.item;
  const next = sort === 'newest' ? [last?.id] : [last?.priceAmount, last?.id];
  return { items, nextCursor: rows.length > limit ? encode(next) : null };
}

export async function getPublicItem(idParam) {
  const id = parseId(idParam, 'Item not found', 'ITEM_NOT_FOUND');
  const [row] = await db
    .select({ item, currency: store.currency })
    .from(item)
    .innerJoin(store, eq(store.id, item.storeId))
    .where(and(eq(item.id, id), ...publicWhere));
  if (!row) throw new HttpError(404, 'Item not found', 'ITEM_NOT_FOUND');
  const [presented] = await decorate([row.item], () => row.currency, false);
  return presented;
}

// ---------- descuentos ----------
function parseDate(value, field, code) {
  const d = new Date(value);
  if (typeof value !== 'string' || Number.isNaN(d.getTime())) throw bad(`${field} must be an ISO date`, code);
  return d;
}

export async function createDiscount(storeId, idParam, body) {
  const row = await findOwnItem(storeId, idParam);
  const b = object(body);
  if (!['percent', 'fixed'].includes(b.type)) throw bad('type must be percent or fixed', 'INVALID_DISCOUNT_TYPE');
  const value = integer(b.value, 'value', 1, b.type === 'percent' ? 10000 : MAX_PRICE, 'INVALID_DISCOUNT_VALUE');
  if (b.type === 'fixed' && value >= row.priceAmount) throw bad('A fixed discount must be lower than the price', 'INVALID_DISCOUNT_VALUE');
  const startsAt = b.startsAt === undefined ? new Date() : parseDate(b.startsAt, 'startsAt', 'INVALID_DISCOUNT_DATES');
  const endsAt = b.endsAt == null ? null : parseDate(b.endsAt, 'endsAt', 'INVALID_DISCOUNT_DATES');
  if (endsAt && endsAt <= startsAt) throw bad('endsAt must be after startsAt', 'INVALID_DISCOUNT_DATES');
  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from item where id = ${row.id} for update`); // serializa altas de descuentos del mismo ítem
    const active = await tx.select().from(itemDiscount).where(and(eq(itemDiscount.itemId, row.id), eq(itemDiscount.active, true)));
    const overlaps = active.some((d) => (endsAt == null || d.startsAt < endsAt) && (d.endsAt == null || d.endsAt > startsAt));
    if (overlaps) throw new HttpError(409, 'The item already has a discount in that period', 'DISCOUNT_OVERLAP');
    const [created] = await tx.insert(itemDiscount).values({ itemId: row.id, type: b.type, value, startsAt, endsAt }).returning();
    return created;
  });
}

export async function deactivateDiscount(storeId, idParam, discountParam) {
  const row = await findOwnItem(storeId, idParam);
  const discountId = parseId(discountParam, 'Discount not found', 'DISCOUNT_NOT_FOUND');
  const [updated] = await db
    .update(itemDiscount)
    .set({ active: false })
    .where(and(eq(itemDiscount.id, discountId), eq(itemDiscount.itemId, row.id)))
    .returning();
  if (!updated) throw new HttpError(404, 'Discount not found', 'DISCOUNT_NOT_FOUND');
  return updated;
}
