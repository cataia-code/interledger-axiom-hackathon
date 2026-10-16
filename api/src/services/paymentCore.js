import { and, eq, inArray, sql } from 'drizzle-orm';
import { payment, refund } from '../db/payments.js';
import { HttpError } from '../middlewares/errorHandler.js';
import { provider } from '../payments/index.js';

const PAID = ['captured', 'partially_refunded'];

async function lockPayment(tx, paymentId) {
  await tx.execute(sql`select id from payment where id = ${paymentId} for update`);
  const [row] = await tx.select().from(payment).where(eq(payment.id, paymentId));
  return row;
}

export async function refundedTotal(tx, paymentId) {
  const [row] = await tx
    .select({ total: sql`coalesce(sum(${refund.amount}), 0)::bigint` })
    .from(refund)
    .where(and(eq(refund.paymentId, paymentId), eq(refund.status, 'succeeded')));
  return Number(row.total);
}

// Reembolsa `amount` de un pago cobrado. Bloquea el pago para que dos reembolsos no superen lo cobrado.
export async function refundPayment(tx, paymentId, amount, { reason = null, createdBy = null } = {}) {
  const p = await lockPayment(tx, paymentId);
  if (!p || !PAID.includes(p.status)) throw new HttpError(409, 'That payment cannot be refunded', 'PAYMENT_NOT_REFUNDABLE');
  const remaining = p.amount - (await refundedTotal(tx, p.id));
  if (!Number.isSafeInteger(amount) || amount < 1) throw new HttpError(400, 'amount must be a positive integer', 'INVALID_AMOUNT');
  if (amount > remaining) throw new HttpError(409, `Only ${remaining} can still be refunded`, 'REFUND_EXCEEDS_PAYMENT');
  const { providerRef } = await provider.refund({ payment: p, amount });
  const [r] = await tx.insert(refund).values({ paymentId: p.id, amount, reason, providerRef, createdBy }).returning();
  await tx.update(payment).set({ status: amount === remaining ? 'refunded' : 'partially_refunded' }).where(eq(payment.id, p.id));
  return r;
}

// Un pedido se cancela: los pagos pendientes se anulan y lo cobrado se reembolsa por completo.
export async function settlePaymentsOnCancel(tx, orderId, reason) {
  await tx.update(payment).set({ status: 'cancelled' }).where(and(eq(payment.orderId, orderId), eq(payment.status, 'pending')));
  const paid = await tx
    .select()
    .from(payment)
    .where(and(eq(payment.orderId, orderId), inArray(payment.status, PAID)));
  for (const p of paid) {
    const remaining = p.amount - (await refundedTotal(tx, p.id));
    if (remaining > 0) await refundPayment(tx, p.id, remaining, { reason });
  }
}
