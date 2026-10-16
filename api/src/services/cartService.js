import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { store } from '../db/business.js';
import { item } from '../db/catalog.js';
import { cart, cartItem } from '../db/orders.js';
import { HttpError } from '../middlewares/errorHandler.js';
import { integer, parseId } from './validation.js';
import { currentDiscounts, priceLine, totalsOf } from './pricingService.js';
import { reservedByItem } from './stockService.js';

export const MAX_LINE_QUANTITY = 999;

async function activeCart(userId) {
  await db.execute(sql`insert into cart (user_id) values (${userId}) on conflict (user_id) where status = 'active' do nothing`);
  const [row] = await db.select().from(cart).where(and(eq(cart.userId, userId), eq(cart.status, 'active')));
  return row;
}

// El ítem se puede comprar: activo, no borrado y de una sucursal activa.
export const purchasable = (r) => r.item.status === 'active' && !r.item.deletedAt && r.store.status === 'active' && !r.store.deletedAt;

export async function cartRows(cartId, executor = db) {
  return executor
    .select({ item, store, quantity: cartItem.quantity })
    .from(cartItem)
    .innerJoin(item, eq(item.id, cartItem.itemId))
    .innerJoin(store, eq(store.id, item.storeId))
    .where(eq(cartItem.cartId, cartId))
    .orderBy(cartItem.addedAt, cartItem.itemId);
}

// Carrito con precios y disponibilidad al momento de consultarlo.
export async function viewCart(userId) {
  const c = await activeCart(userId);
  const rows = await cartRows(c.id);
  const ids = rows.map((r) => r.item.id);
  const [discounts, reserved] = await Promise.all([currentDiscounts(ids), reservedByItem(ids)]);
  const lines = rows.map((r) => {
    const price = priceLine(r.item.priceAmount, discounts.get(r.item.id), r.quantity);
    return { r, price, available: r.item.currentStock - reserved.get(r.item.id) };
  });
  const buyable = lines.filter((l) => purchasable(l.r));
  const totals = totalsOf(buyable.map((l) => l.price));
  return {
    id: c.id,
    storeId: rows[0]?.store.id ?? null,
    currency: rows[0]?.store.currency ?? null,
    lines: lines.map(({ r, price, available }) => ({
      itemId: r.item.id,
      name: r.item.name,
      sku: r.item.sku,
      quantity: r.quantity,
      originalUnitAmount: price.originalUnit,
      discountUnitAmount: price.discountUnit,
      unitAmount: price.unit,
      lineAmount: price.line,
      available,
      purchasable: purchasable({ item: r.item, store: r.store }) && available >= r.quantity,
    })),
    subtotalAmount: totals.subtotal,
    discountAmount: totals.discount,
    totalAmount: totals.total,
  };
}

// Pone la cantidad de un ítem en el carrito (la crea o la reemplaza).
export async function setCartItem(userId, itemParam, quantityInput) {
  const itemId = parseId(itemParam, 'Item not found', 'ITEM_NOT_FOUND');
  const quantity = integer(quantityInput, 'quantity', 1, MAX_LINE_QUANTITY, 'INVALID_QUANTITY');
  const [found] = await db
    .select({ item, store })
    .from(item)
    .innerJoin(store, eq(store.id, item.storeId))
    .where(eq(item.id, itemId));
  if (!found || !purchasable(found)) throw new HttpError(404, 'Item not found', 'ITEM_NOT_FOUND');
  const available = found.item.currentStock - (await reservedByItem([itemId])).get(itemId);
  if (quantity > available) throw new HttpError(409, `Only ${Math.max(available, 0)} available`, 'INSUFFICIENT_STOCK');
  const c = await activeCart(userId);
  const others = await cartRows(c.id);
  if (others.some((r) => r.item.storeId !== found.item.storeId)) {
    throw new HttpError(409, 'The cart already has items from another store; empty it first', 'CART_OTHER_STORE');
  }
  await db
    .insert(cartItem)
    .values({ cartId: c.id, itemId, quantity })
    .onConflictDoUpdate({ target: [cartItem.cartId, cartItem.itemId], set: { quantity } });
  await db.update(cart).set({ updatedAt: new Date() }).where(eq(cart.id, c.id));
  return viewCart(userId);
}

export async function removeCartItem(userId, itemParam) {
  const itemId = parseId(itemParam, 'Item not found', 'ITEM_NOT_FOUND');
  const c = await activeCart(userId);
  const removed = await db.delete(cartItem).where(and(eq(cartItem.cartId, c.id), eq(cartItem.itemId, itemId))).returning();
  if (removed.length === 0) throw new HttpError(404, 'That item is not in the cart', 'CART_ITEM_NOT_FOUND');
  return viewCart(userId);
}

export async function clearCart(userId) {
  const c = await activeCart(userId);
  await db.delete(cartItem).where(eq(cartItem.cartId, c.id));
}
