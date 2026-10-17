import { and, eq, sql } from 'drizzle-orm';
import { coupon, couponItem, couponRedemption, couponWallet } from '../db/coupons.js';
import { HttpError } from '../middlewares/errorHandler.js';

// Reglas y cálculo de los cupones. No depende del carrito ni de los pedidos, para que ambos lo usen.

const fail = (status, message, code) => new HttpError(status, message, code);

// Datos que hacen falta para decidir si un usuario puede usar un cupón. `lock` bloquea la fila del cupón
// (checkout), así dos compradores no se llevan el último uso.
export async function loadCouponFacts(executor, couponId, userId, { lock = false } = {}) {
  const query = executor.select().from(coupon).where(eq(coupon.id, couponId));
  const [row] = await (lock ? query.for('update') : query);
  if (!row || row.deletedAt) throw fail(404, 'Coupon not found', 'COUPON_NOT_FOUND');
  const [wallet, items, counts] = await Promise.all([
    executor.select().from(couponWallet).where(and(eq(couponWallet.couponId, couponId), eq(couponWallet.userId, Number(userId)))),
    executor.select({ itemId: couponItem.itemId }).from(couponItem).where(eq(couponItem.couponId, couponId)),
    executor.execute(sql`
      select count(*) filter (where status = 'reserved')::int as used,
             count(*) filter (where status = 'reserved' and user_id = ${Number(userId)})::int as "usedByUser"
      from coupon_redemption where coupon_id = ${couponId}`),
  ]);
  return {
    coupon: row,
    inWallet: wallet.length > 0,
    walletSource: wallet[0]?.source ?? null,
    itemIds: new Set(items.map((i) => Number(i.itemId))),
    used: counts.rows[0].used,
    usedByUser: counts.rows[0].usedByUser,
  };
}

// Estado de un cupón para quien lo mira: available | used | exhausted | expired | upcoming | paused.
export function couponState(facts, now = new Date()) {
  const c = facts.coupon;
  if (c.status === 'paused') return 'paused';
  if (c.endsAt && c.endsAt <= now) return 'expired';
  if (c.startsAt > now) return 'upcoming';
  if (facts.usedByUser >= c.perUserLimit) return 'used';
  if (c.maxRedemptions != null && facts.used >= c.maxRedemptions) return 'exhausted';
  return 'available';
}

const STATE_ERRORS = {
  paused: [409, 'The coupon is paused', 'COUPON_PAUSED'],
  expired: [409, 'The coupon has expired', 'COUPON_EXPIRED'],
  upcoming: [409, 'The coupon is not valid yet', 'COUPON_NOT_STARTED'],
  used: [409, 'You already used this coupon the allowed number of times', 'COUPON_USER_LIMIT'],
  exhausted: [409, 'The coupon has no uses left', 'COUPON_EXHAUSTED'],
};

// Descuento del cupón sobre las líneas ya con su descuento de ítem. `lines`: [{ itemId, lineAmount }].
// Nunca supera el tope, la base aplicable ni deja el pedido en 0.
export function computeCouponDiscount(c, applicableItemIds, lines, itemTotal) {
  const eligible = applicableItemIds.size > 0 ? lines.filter((l) => applicableItemIds.has(Number(l.itemId))) : lines;
  const base = eligible.reduce((sum, l) => sum + l.lineAmount, 0);
  const raw = c.type === 'percent' ? Math.floor((base * c.value) / 10000) : c.value;
  return Math.max(0, Math.min(raw, c.maxDiscountAmount ?? Infinity, base, itemTotal - 1));
}

// Decide si el cupón se puede aplicar a este carrito y cuánto descuenta; si no, lanza el error con su código.
export function evaluateCoupon(facts, { storeId, lines, itemTotal, now = new Date() }) {
  const c = facts.coupon;
  if (c.storeId !== storeId) throw fail(409, 'The coupon belongs to another store', 'COUPON_WRONG_STORE');
  if (!facts.inWallet) throw fail(403, 'You do not have this coupon', 'COUPON_NOT_ELIGIBLE');
  const state = couponState(facts, now);
  if (state !== 'available') throw fail(...STATE_ERRORS[state]);
  if (itemTotal < c.minSubtotalAmount) throw fail(409, `The order must be at least ${c.minSubtotalAmount} to use this coupon`, 'COUPON_MIN_NOT_MET');
  const discount = computeCouponDiscount(c, facts.itemIds, lines, itemTotal);
  if (discount <= 0) throw fail(409, 'The coupon does not apply to the items in the cart', 'COUPON_NOT_APPLICABLE');
  return { discount };
}

export async function recordRedemption(tx, { couponId, userId, orderId, discountAmount }) {
  await tx.insert(couponRedemption).values({ couponId, userId: Number(userId), orderId, discountAmount });
}

// Pedido cancelado o vencido: el uso vuelve a estar disponible. Un reembolso posterior no lo devuelve.
export async function releaseRedemption(tx, orderId) {
  await tx
    .update(couponRedemption)
    .set({ status: 'released', releasedAt: new Date() })
    .where(and(eq(couponRedemption.orderId, orderId), eq(couponRedemption.status, 'reserved')));
}
