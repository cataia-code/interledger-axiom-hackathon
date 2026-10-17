import { eq, sql } from 'drizzle-orm';
import { order, orderStatusHistory } from '../db/orders.js';
import { HttpError } from '../middlewares/errorHandler.js';
import { settlePaymentsOnCancel } from './paymentCore.js';
import { releaseRedemption } from './couponEngine.js';
import { confirmReservations, releaseReservations, restockOrder } from './stockService.js';

export const ORDER_STATUSES = ['pending_payment', 'paid', 'preparing', 'completed', 'cancelled', 'refunded'];

// Transiciones válidas y quién puede ejecutarlas (system = pagos y jobs).
const TRANSITIONS = {
  pending_payment: { paid: ['system'], cancelled: ['buyer', 'seller', 'system'] },
  paid: { preparing: ['seller'], cancelled: ['buyer', 'seller', 'system'] },
  preparing: { completed: ['seller'], cancelled: ['seller', 'system'] },
  completed: { refunded: ['system'] },
  cancelled: {},
  refunded: {},
};

export const canTransition = (from, to, actor) => TRANSITIONS[from]?.[to]?.includes(actor) ?? false;

// Cambia el estado dentro de la transacción `tx`: bloquea el pedido, aplica los efectos sobre el stock y deja historial.
export async function transitionOrder(tx, orderId, to, { actor, actorId = null, note = null }) {
  const res = await tx.execute(sql`select id, status from "order" where id = ${orderId} for update`);
  const current = res.rows[0];
  if (!current) throw new HttpError(404, 'Order not found', 'ORDER_NOT_FOUND');
  const from = current.status;
  if (!canTransition(from, to, actor)) {
    throw new HttpError(409, `An order ${from} cannot go to ${to}`, 'INVALID_TRANSITION');
  }
  if (to === 'paid') await confirmReservations(tx, orderId);
  if (to === 'cancelled') {
    if (from === 'pending_payment') await releaseReservations(tx, orderId);
    else await restockOrder(tx, orderId, 'Pedido cancelado');
    await settlePaymentsOnCancel(tx, orderId, note ?? 'Pedido cancelado');
    await releaseRedemption(tx, orderId);
  }
  const [row] = await tx.update(order).set({ status: to }).where(eq(order.id, orderId)).returning();
  await tx.insert(orderStatusHistory).values({ orderId, fromStatus: from, toStatus: to, actorId, note });
  return row;
}
