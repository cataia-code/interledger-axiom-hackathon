import { randomBytes } from 'node:crypto';
import { and, asc, desc, eq, lt } from 'drizzle-orm';
import { config } from '../config/index.js';
import { db } from '../db/index.js';
import { cart, order, orderItem, orderStatusHistory } from '../db/orders.js';
import { HttpError } from '../middlewares/errorHandler.js';
import { bad, integer, parseId } from './validation.js';
import { cartRows, purchasable } from './cartService.js';
import { commissionOf, currentDiscounts, priceLine, totalsOf } from './pricingService.js';
import { reserveStock } from './stockService.js';
import { evaluateCoupon, loadCouponFacts, recordRedemption } from './couponEngine.js';
import { ORDER_STATUSES, transitionOrder } from './orderStateMachine.js';

export const presentOrder = (o, { items, history } = {}) => ({
  id: o.id,
  number: o.number,
  buyerId: o.buyerId,
  storeId: o.storeId,
  status: o.status,
  currency: o.currency,
  subtotalAmount: o.subtotalAmount,
  discountAmount: o.discountAmount, // descuentos de ítem
  couponId: o.couponId,
  couponCode: o.couponCode,
  couponDiscountAmount: o.couponDiscountAmount,
  totalAmount: o.totalAmount,
  commissionRate: o.commissionRate,
  commissionAmount: o.commissionAmount,
  expiresAt: o.expiresAt,
  createdAt: o.createdAt,
  ...(items && {
    items: items.map((i) => ({
      itemId: i.itemId,
      name: i.nameSnapshot,
      sku: i.skuSnapshot,
      quantity: i.quantity,
      originalUnitAmount: i.originalUnitAmount,
      discountUnitAmount: i.discountUnitAmount,
      unitAmount: i.unitAmount,
      lineAmount: i.lineAmount,
    })),
  }),
  ...(history && {
    history: history.map((h) => ({ from: h.fromStatus, to: h.toStatus, actorId: h.actorId, note: h.note, at: h.createdAt })),
  }),
});

async function withDetails(o) {
  const [items, history] = await Promise.all([
    db.select().from(orderItem).where(eq(orderItem.orderId, o.id)).orderBy(asc(orderItem.id)),
    db.select().from(orderStatusHistory).where(eq(orderStatusHistory.orderId, o.id)).orderBy(asc(orderStatusHistory.id)),
  ]);
  return presentOrder(o, { items, history });
}

function parseKey(key) {
  if (typeof key !== 'string' || !/^[A-Za-z0-9_.:-]{8,80}$/.test(key.trim())) {
    throw bad('Send an Idempotency-Key header of 8 to 80 characters (letters, digits, _ . : -)', 'IDEMPOTENCY_KEY_REQUIRED');
  }
  return key.trim();
}

const uniqueViolation = (error, constraint) => {
  const err = error.cause ?? error;
  return err.code === '23505' && err.constraint === constraint;
};

async function findByKey(buyerId, key) {
  const [row] = await db.select().from(order).where(and(eq(order.buyerId, buyerId), eq(order.idempotencyKey, key)));
  return row;
}

// Convierte el carrito activo en un pedido a la sucursal: congela precios, reserva stock y guarda el historial.
// Repetir la misma clave devuelve el pedido ya creado (created: false).
export async function checkout(userId, rawKey) {
  const buyerId = Number(userId);
  const key = parseKey(rawKey);
  const existing = await findByKey(buyerId, key);
  if (existing) return { order: await withDetails(existing), created: false };

  const [activeCart] = await db.select().from(cart).where(and(eq(cart.userId, buyerId), eq(cart.status, 'active')));
  const rows = activeCart ? await cartRows(activeCart.id) : [];
  if (rows.length === 0) throw new HttpError(400, 'The cart is empty', 'CART_EMPTY');
  const unavailable = rows.find((r) => !purchasable(r));
  if (unavailable) throw new HttpError(409, `"${unavailable.item.name}" is no longer available`, 'ITEM_UNAVAILABLE');
  const store = rows[0].store;
  if (rows.some((r) => r.item.storeId !== store.id)) throw new HttpError(409, 'The cart has items from several stores', 'CART_OTHER_STORE');

  const discounts = await currentDiscounts(rows.map((r) => r.item.id));
  const lines = rows.map((r) => ({ r, price: priceLine(r.item.priceAmount, discounts.get(r.item.id), r.quantity) }));
  const totals = totalsOf(lines.map((l) => l.price));
  if (totals.total <= 0) throw new HttpError(400, 'Free orders are not supported yet', 'EMPTY_TOTAL');
  const expiresAt = new Date(Date.now() + config.reservationTtlMinutes * 60_000);

  try {
    const created = await db.transaction(async (tx) => {
      // Cupón del carrito: se bloquea y se valida de nuevo aquí, que es lo que cuenta (el carrito solo lo mostraba).
      let applied = null;
      if (activeCart.couponId) {
        const facts = await loadCouponFacts(tx, activeCart.couponId, buyerId, { lock: true });
        const { discount } = evaluateCoupon(facts, {
          storeId: store.id,
          lines: lines.map((l) => ({ itemId: l.r.item.id, lineAmount: l.price.line })),
          itemTotal: totals.total,
        });
        applied = { id: facts.coupon.id, label: facts.coupon.code ?? facts.coupon.title, discount };
      }
      const total = totals.total - (applied?.discount ?? 0);
      const [o] = await tx
        .insert(order)
        .values({
          number: `ORD-${randomBytes(5).toString('hex').toUpperCase()}`,
          buyerId,
          storeId: store.id,
          subtotalAmount: totals.subtotal,
          discountAmount: totals.discount,
          couponId: applied?.id ?? null,
          couponCode: applied?.label ?? null,
          couponDiscountAmount: applied?.discount ?? 0,
          totalAmount: total,
          commissionRate: config.commissionRate,
          commissionAmount: commissionOf(total, config.commissionRate),
          currency: store.currency,
          idempotencyKey: key,
          expiresAt,
        })
        .returning();
      // Primero se bloquean los ítems (reserva); insertar order_item antes tomaría un lock compartido y provocaría interbloqueos.
      await reserveStock(tx, { orderId: o.id, lines: lines.map((l) => ({ itemId: l.r.item.id, quantity: l.price.quantity })) });
      await tx.insert(orderItem).values(
        lines.map(({ r, price }) => ({
          orderId: o.id,
          itemId: r.item.id,
          nameSnapshot: r.item.name,
          skuSnapshot: r.item.sku,
          originalUnitAmount: price.originalUnit,
          discountUnitAmount: price.discountUnit,
          unitAmount: price.unit,
          quantity: price.quantity,
          lineAmount: price.line,
        })),
      );
      if (applied) await recordRedemption(tx, { couponId: applied.id, userId: buyerId, orderId: o.id, discountAmount: applied.discount });
      await tx.insert(orderStatusHistory).values({ orderId: o.id, fromStatus: null, toStatus: 'pending_payment', actorId: buyerId });
      await tx.update(cart).set({ status: 'converted' }).where(eq(cart.id, activeCart.id));
      return o;
    });
    return { order: await withDetails(created), created: true };
  } catch (err) {
    if (uniqueViolation(err, 'order_buyer_idempotency_unique')) return { order: await withDetails(await findByKey(buyerId, key)), created: false };
    throw err;
  }
}

// ---------- consultas ----------
async function list(where, query) {
  const limit = query.limit === undefined ? 20 : integer(query.limit, 'limit', 1, 50, 'INVALID_LIMIT');
  const conditions = [...where];
  if (query.status !== undefined) {
    if (!ORDER_STATUSES.includes(query.status)) throw bad(`status must be one of ${ORDER_STATUSES.join(', ')}`, 'INVALID_STATUS');
    conditions.push(eq(order.status, query.status));
  }
  if (query.cursor) {
    const cursor = Number(query.cursor);
    if (!Number.isSafeInteger(cursor)) throw bad('cursor is not valid', 'INVALID_CURSOR');
    conditions.push(lt(order.id, cursor));
  }
  const rows = await db.select().from(order).where(and(...conditions)).orderBy(desc(order.id)).limit(limit + 1);
  const page = rows.slice(0, limit);
  return { orders: page.map((o) => presentOrder(o)), nextCursor: rows.length > limit ? String(page.at(-1).id) : null };
}

export const listBuyerOrders = (userId, query) => list([eq(order.buyerId, Number(userId))], query);
export const listStoreOrders = (storeId, query) => list([eq(order.storeId, storeId)], query);

async function findOrder(idParam, ownership) {
  const id = parseId(idParam, 'Order not found', 'ORDER_NOT_FOUND');
  const [row] = await db.select().from(order).where(and(eq(order.id, id), ownership));
  if (!row) throw new HttpError(404, 'Order not found', 'ORDER_NOT_FOUND');
  return row;
}

export const getBuyerOrder = async (userId, idParam) => withDetails(await findOrder(idParam, eq(order.buyerId, Number(userId))));
export const getStoreOrder = async (storeId, idParam) => withDetails(await findOrder(idParam, eq(order.storeId, storeId)));

// ---------- cambios de estado ----------
export async function buyerCancel(userId, idParam) {
  const row = await findOrder(idParam, eq(order.buyerId, Number(userId)));
  await db.transaction((tx) => transitionOrder(tx, row.id, 'cancelled', { actor: 'buyer', actorId: Number(userId) }));
  return getBuyerOrder(userId, row.id);
}

const SELLER_TARGETS = ['preparing', 'completed', 'cancelled'];
export async function sellerTransition(storeId, userId, idParam, body) {
  const to = body?.status;
  if (!SELLER_TARGETS.includes(to)) throw bad(`status must be one of ${SELLER_TARGETS.join(', ')}`, 'INVALID_STATUS');
  const row = await findOrder(idParam, eq(order.storeId, storeId));
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 200) || null : null;
  await db.transaction((tx) => transitionOrder(tx, row.id, to, { actor: 'seller', actorId: Number(userId), note }));
  return getStoreOrder(storeId, row.id);
}

// Pedidos sin pagar a tiempo: se cancelan y liberan su stock.
export async function cancelExpiredOrders(now = new Date()) {
  const due = await db
    .select({ id: order.id })
    .from(order)
    .where(and(eq(order.status, 'pending_payment'), lt(order.expiresAt, now)));
  let cancelled = 0;
  for (const { id } of due) {
    try {
      await db.transaction((tx) => transitionOrder(tx, id, 'cancelled', { actor: 'system', note: 'Payment timeout' }));
      cancelled += 1;
    } catch (err) {
      if (err.code !== 'INVALID_TRANSITION') throw err; // otro proceso lo cambió antes
    }
  }
  return cancelled;
}
