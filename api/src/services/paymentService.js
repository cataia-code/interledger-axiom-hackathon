import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { order } from '../db/orders.js';
import { payment, paymentEvent, refund } from '../db/payments.js';
import { HttpError } from '../middlewares/errorHandler.js';
import { provider } from '../payments/index.js';
import { bad, integer, object, optional, parseId } from './validation.js';
import { transitionOrder } from './orderStateMachine.js';
import { refundedTotal, refundPayment } from './paymentCore.js';

const PAID = ['captured', 'partially_refunded', 'refunded'];

export const presentPayment = (p, refunds = []) => ({
  id: p.id,
  orderId: p.orderId,
  provider: p.provider,
  providerRef: p.providerRef,
  status: p.status,
  amount: p.amount,
  currency: p.currency,
  createdAt: p.createdAt,
  refunds: refunds.map((r) => ({ id: r.id, amount: r.amount, reason: r.reason, status: r.status, createdAt: r.createdAt })),
});

const uniqueViolation = (error, constraint) => {
  const err = error.cause ?? error;
  return err.code === '23505' && err.constraint === constraint;
};

function parseKey(key) {
  if (typeof key !== 'string' || !/^[A-Za-z0-9_.:-]{8,80}$/.test(key.trim())) {
    throw bad('Send an Idempotency-Key header of 8 to 80 characters (letters, digits, _ . : -)', 'IDEMPOTENCY_KEY_REQUIRED');
  }
  return key.trim();
}

async function ownOrder(buyerId, idParam) {
  const id = parseId(idParam, 'Order not found', 'ORDER_NOT_FOUND');
  const [row] = await db.select().from(order).where(and(eq(order.id, id), eq(order.buyerId, buyerId)));
  if (!row) throw new HttpError(404, 'Order not found', 'ORDER_NOT_FOUND');
  return row;
}

// Inicia el cobro de un pedido pendiente. Repetir la misma clave, o pedir otro cobro mientras hay uno pendiente,
// devuelve el existente: nunca se crean dos cobros simultáneos para el mismo pedido.
export async function startPayment(userId, idParam, rawKey) {
  const buyerId = Number(userId);
  const key = parseKey(rawKey);
  const o = await ownOrder(buyerId, idParam);
  const mine = await db.select().from(payment).where(eq(payment.orderId, o.id)).orderBy(desc(payment.id));
  const sameKey = mine.find((p) => p.idempotencyKey === key);
  if (sameKey) return { payment: presentPayment(sameKey), created: false };
  if (o.status !== 'pending_payment' || o.expiresAt <= new Date()) {
    throw new HttpError(409, 'This order cannot be paid', 'ORDER_NOT_PAYABLE');
  }
  const pending = mine.find((p) => p.status === 'pending');
  if (pending) return { payment: presentPayment(pending), created: false };

  try {
    const created = await db.transaction(async (tx) => {
      const [p] = await tx
        .insert(payment)
        .values({ orderId: o.id, provider: provider.name, amount: o.totalAmount, currency: o.currency, idempotencyKey: key })
        .returning();
      const { providerRef } = await provider.createPayment({ payment: p, order: o });
      const [updated] = await tx.update(payment).set({ providerRef }).where(eq(payment.id, p.id)).returning();
      return updated;
    });
    return { payment: presentPayment(created), created: true };
  } catch (err) {
    if (uniqueViolation(err, 'payment_order_idempotency_unique')) {
      const [p] = await db.select().from(payment).where(and(eq(payment.orderId, o.id), eq(payment.idempotencyKey, key)));
      return { payment: presentPayment(p), created: false };
    }
    throw err;
  }
}

// Cobro confirmado: el pedido pasa a pagado. Si ya no se puede (venció y no queda stock, o ya estaba cancelado),
// el dinero recibido se devuelve completo.
async function capture(tx, p) {
  if (PAID.includes(p.status)) return;
  await tx.update(payment).set({ status: 'captured' }).where(eq(payment.id, p.id));
  const [o] = await tx.select().from(order).where(eq(order.id, p.orderId));
  if (o.status === 'pending_payment') {
    try {
      await tx.transaction((sp) => transitionOrder(sp, o.id, 'paid', { actor: 'system', note: 'Payment captured' }));
      return;
    } catch (err) {
      if (err.code !== 'INSUFFICIENT_STOCK') throw err;
      // sin stock: se cancela el pedido (libera reservas y reembolsa lo cobrado)
      await tx.transaction((sp) => transitionOrder(sp, o.id, 'cancelled', { actor: 'system', note: 'Paid after the reservation expired and stock ran out' }));
      return;
    }
  }
  await refundPayment(tx, p.id, p.amount, { reason: 'The order was no longer payable' });
}

// Cobro fallido: el pedido sigue pendiente (con su reserva) para que el buyer pueda reintentar.
async function fail(tx, p) {
  if (p.status === 'pending') await tx.update(payment).set({ status: 'failed' }).where(eq(payment.id, p.id));
}

// Webhook del proveedor. El evento se guarda y se procesa en la misma transacción: si algo falla se revierte
// todo y el proveedor puede reenviarlo; si ya se procesó, el reenvío se ignora.
export async function handleWebhook(headers, body) {
  const event = provider.verifyWebhook(headers, body);
  return db.transaction(async (tx) => {
    const [recorded] = await tx
      .insert(paymentEvent)
      .values({ providerEventId: event.eventId, type: event.type, payload: body })
      .onConflictDoNothing()
      .returning();
    if (!recorded) return { status: 'duplicate' };
    const [p] = await tx
      .select()
      .from(payment)
      .where(and(eq(payment.provider, provider.name), eq(payment.providerRef, event.providerRef)));
    if (!p) {
      await tx.update(paymentEvent).set({ processedAt: new Date() }).where(eq(paymentEvent.id, recorded.id));
      return { status: 'ignored' };
    }
    await tx.update(paymentEvent).set({ paymentId: p.id }).where(eq(paymentEvent.id, recorded.id));
    if (event.type === 'payment.captured') await capture(tx, p);
    else await fail(tx, p);
    await tx.update(paymentEvent).set({ processedAt: new Date() }).where(eq(paymentEvent.id, recorded.id));
    return { status: 'processed' };
  });
}

// ---------- consultas ----------
async function withRefunds(orderId) {
  const payments = await db.select().from(payment).where(eq(payment.orderId, orderId)).orderBy(asc(payment.id));
  if (payments.length === 0) return [];
  const refunds = await db.select().from(refund).where(inArray(refund.paymentId, payments.map((p) => p.id))).orderBy(asc(refund.id));
  return payments.map((p) => presentPayment(p, refunds.filter((r) => r.paymentId === p.id)));
}

export async function buyerPayments(userId, idParam) {
  const o = await ownOrder(Number(userId), idParam);
  return withRefunds(o.id);
}

export async function storePayments(storeId, idParam) {
  const o = await storeOrder(storeId, idParam);
  return withRefunds(o.id);
}

async function storeOrder(storeId, idParam) {
  const id = parseId(idParam, 'Order not found', 'ORDER_NOT_FOUND');
  const [row] = await db.select().from(order).where(and(eq(order.id, id), eq(order.storeId, storeId)));
  if (!row) throw new HttpError(404, 'Order not found', 'ORDER_NOT_FOUND');
  return row;
}

// ---------- reembolsos del seller ----------
// Parcial en cualquier momento; el total de un pedido sin completar se hace cancelándolo.
export async function sellerRefund(storeId, userId, idParam, body) {
  const o = await storeOrder(storeId, idParam);
  const b = object(body);
  const reason = optional(b.reason, 'reason', 200, 'INVALID_REASON');
  const [p] = await db.select().from(payment).where(and(eq(payment.orderId, o.id), inArray(payment.status, ['captured', 'partially_refunded'])));
  if (!p) throw new HttpError(409, 'The order has no payment to refund', 'PAYMENT_NOT_REFUNDABLE');
  const result = await db.transaction(async (tx) => {
    const remaining = p.amount - (await refundedTotal(tx, p.id));
    const amount = b.amount === undefined ? remaining : integer(b.amount, 'amount', 1, remaining, 'INVALID_AMOUNT');
    if (amount === remaining && ['paid', 'preparing'].includes(o.status)) {
      throw new HttpError(409, 'Cancel the order to refund it in full', 'USE_CANCEL');
    }
    const r = await refundPayment(tx, p.id, amount, { reason, createdBy: Number(userId) });
    if (amount === remaining && o.status === 'completed') {
      await transitionOrder(tx, o.id, 'refunded', { actor: 'system', actorId: Number(userId), note: reason });
    }
    return r;
  });
  return { refund: { id: result.id, amount: result.amount, reason: result.reason, status: result.status, createdAt: result.createdAt }, payments: await withRefunds(o.id) };
}
