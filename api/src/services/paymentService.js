import { and, asc, desc, eq, inArray, ne } from 'drizzle-orm';
import { config } from '../config/index.js';
import { db } from '../db/index.js';
import { order } from '../db/orders.js';
import { organization, store } from '../db/business.js';
import { userWallet, paymentSession } from '../db/wallets.js';
import { payment, paymentEvent, refund } from '../db/payments.js';
import { HttpError } from '../middlewares/errorHandler.js';
import { provider } from '../payments/index.js';
import { bad, integer, object, optional, parseId } from './validation.js';
import { transitionOrder } from './orderStateMachine.js';
import { refundedTotal, refundPayment } from './paymentCore.js';

const PAID = ['captured', 'partially_refunded', 'refunded'];

// Lo que el front muestra antes de redirigir: cuánto llega, cuánto sale, la comisión y hasta cuándo vale la cotización.
export function presentCheckout(s) {
  const sameAsset = s.receiveAssetCode === s.debitAssetCode && s.receiveAssetScale === s.debitAssetScale;
  const amt = (value, assetCode, assetScale) => ({ value, assetCode, assetScale });
  return {
    redirectUrl: s.redirectUrl,
    buyerWallet: s.buyerWallet,
    expiresAt: s.quoteExpiresAt,
    receive: amt(s.receiveValue, s.receiveAssetCode, s.receiveAssetScale),
    debit: amt(s.debitValue, s.debitAssetCode, s.debitAssetScale),
    fee: sameAsset ? amt((BigInt(s.debitValue) - BigInt(s.receiveValue)).toString(), s.debitAssetCode, s.debitAssetScale) : null,
  };
}

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

const presentWithCheckout = async (p, created) => {
  const [session] = await db
    .select()
    .from(paymentSession)
    .where(and(eq(paymentSession.paymentId, p.id), eq(paymentSession.status, 'pending')))
    .orderBy(desc(paymentSession.id))
    .limit(1);
  return { payment: presentPayment(p), checkout: session ? presentCheckout(session) : null, created };
};

// Inicia el cobro de un pedido pendiente. Repetir la misma clave, o pedir otro cobro mientras hay uno pendiente,
// devuelve el existente: nunca se crean dos cobros simultáneos para el mismo pedido.
export async function startPayment(userId, idParam, rawKey, body = {}) {
  const buyerId = Number(userId);
  const key = parseKey(rawKey);
  const o = await ownOrder(buyerId, idParam);
  const mine = await db.select().from(payment).where(eq(payment.orderId, o.id)).orderBy(desc(payment.id));
  const sameKey = mine.find((p) => p.idempotencyKey === key);
  const openPayments = provider.name === 'openpayments';
  if (sameKey && !(openPayments && sameKey.status === 'pending')) return { payment: presentPayment(sameKey), created: false };
  if (o.status !== 'pending_payment' || o.expiresAt <= new Date()) {
    throw new HttpError(409, 'This order cannot be paid', 'ORDER_NOT_PAYABLE');
  }
  const pending = mine.find((p) => p.status === 'pending');
  if (openPayments) return startOpenPayment(buyerId, o, pending, key, object(body).walletId);
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

// ---------- Open Payments ----------
// Wallet principal del usuario (la que cobra una tienda y con la que paga un comprador por defecto).
const primaryWalletOf = async (userId) =>
  (await db.select().from(userWallet).where(and(eq(userWallet.userId, userId), eq(userWallet.isPrimary, true))))[0];

// El comprador puede elegir una de sus wallets con `walletId`; si no, se usa la principal.
async function buyerWalletFor(userId, walletId) {
  if (walletId === undefined || walletId === null) return primaryWalletOf(userId);
  const id = integer(walletId, 'walletId', 1, Number.MAX_SAFE_INTEGER, 'INVALID_WALLET_ID');
  const [w] = await db.select().from(userWallet).where(and(eq(userWallet.id, id), eq(userWallet.userId, userId)));
  if (!w) throw new HttpError(404, 'Wallet not found', 'WALLET_NOT_FOUND');
  return w;
}

// Moneda menor de la orden (2 decimales para USD, COP con la escala ISO) llevada a la escala de la wallet del vendedor.
function toWalletUnits(amount, currency, assetScale) {
  const orderScale = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
  if (assetScale >= orderScale) return (BigInt(amount) * 10n ** BigInt(assetScale - orderScale)).toString();
  const divisor = 10n ** BigInt(orderScale - assetScale);
  if (BigInt(amount) % divisor !== 0n) throw new HttpError(409, 'The total cannot be expressed in the seller wallet scale', 'AMOUNT_NOT_REPRESENTABLE');
  return (BigInt(amount) / divisor).toString();
}

// Si hay una cotización vigente se reutiliza; si venció (o nunca hubo), se pide otra: una cotización no se reutiliza vencida.
async function startOpenPayment(buyerId, o, pending, key, walletId) {
  const buyerWallet = await buyerWalletFor(buyerId, walletId);
  if (!buyerWallet) throw new HttpError(409, 'Link your wallet address before paying', 'BUYER_WALLET_REQUIRED');
  if (pending) {
    const [live] = await db
      .select()
      .from(paymentSession)
      .where(and(eq(paymentSession.paymentId, pending.id), eq(paymentSession.status, 'pending')))
      .orderBy(desc(paymentSession.id))
      .limit(1);
    if (live && live.quoteExpiresAt > new Date() && live.buyerWallet === buyerWallet.address) return { payment: presentPayment(pending), checkout: presentCheckout(live), created: false };
  }
  const [owner] = await db
    .select({ userId: organization.userId })
    .from(store)
    .innerJoin(organization, eq(organization.id, store.organizationId))
    .where(eq(store.id, o.storeId));
  const sellerWallet = owner && (await primaryWalletOf(owner.userId));
  if (!sellerWallet) throw new HttpError(409, 'The store has not linked a wallet to receive payments', 'SELLER_WALLET_REQUIRED');
  if (sellerWallet.assetCode !== o.currency) {
    throw new HttpError(409, `The store wallet receives ${sellerWallet.assetCode}, the order is in ${o.currency}`, 'CURRENCY_MISMATCH');
  }

  const { providerRef, session } = await provider.begin({
    orderId: o.id,
    buyerWallet: buyerWallet.address,
    sellerWallet: sellerWallet.address,
    receiveValue: toWalletUnits(o.totalAmount, o.currency, sellerWallet.assetScale),
    returnUrl: `${config.publicApiUrl}/api/v1/payments/openpayments/return/${o.id}`,
  });
  try {
    const saved = await db.transaction(async (tx) => {
      let p = pending;
      if (p) {
        await tx.update(paymentSession).set({ status: 'superseded' }).where(and(eq(paymentSession.paymentId, p.id), eq(paymentSession.status, 'pending')));
        [p] = await tx.update(payment).set({ providerRef }).where(eq(payment.id, p.id)).returning();
      } else {
        [p] = await tx
          .insert(payment)
          .values({ orderId: o.id, provider: provider.name, providerRef, amount: o.totalAmount, currency: o.currency, idempotencyKey: key })
          .returning();
      }
      const [s] = await tx.insert(paymentSession).values({ paymentId: p.id, ...session }).returning();
      return { p, s };
    });
    return { payment: presentPayment(saved.p), checkout: presentCheckout(saved.s), created: !pending };
  } catch (err) {
    // Otra petición con la misma clave ganó la carrera: se devuelve su cobro.
    if (uniqueViolation(err, 'payment_order_idempotency_unique')) {
      const [p] = await db.select().from(payment).where(and(eq(payment.orderId, o.id), eq(payment.idempotencyKey, key)));
      return presentWithCheckout(p, false);
    }
    throw err;
  }
}

// Número visible del pedido (ORD-…) para mostrarlo en la página de resultado.
export async function orderNumberOf(orderId) {
  const [row] = await db.select({ number: order.number }).from(order).where(eq(order.id, orderId));
  return row?.number ?? null;
}

// Vuelta del navegador desde la wallet. Es pública: quien manda es el hash firmado con el nonce de la sesión, y solo un hash
// válido cambia algo. El resultado se decide por lo que realmente se movió, no por haber vuelto al navegador.
export async function completeOpenPayment(orderIdParam, query) {
  const orderId = parseId(orderIdParam, 'Order not found', 'ORDER_NOT_FOUND');
  const [p] = await db.select().from(payment).where(and(eq(payment.orderId, orderId), ne(payment.status, 'cancelled'))).orderBy(desc(payment.id)).limit(1);
  if (!p) throw new HttpError(404, 'Order not found', 'ORDER_NOT_FOUND');
  if (PAID.includes(p.status)) return { status: 'paid', orderId };
  const interactRef = typeof query.interact_ref === 'string' ? query.interact_ref : '';
  const hash = typeof query.hash === 'string' ? query.hash : '';
  if (!interactRef || !hash) return { status: 'denied', orderId }; // consentimiento negado: el pedido sigue sin pagar

  // Reclama la sesión de forma atómica para que dos retornos simultáneos no creen dos outgoing payments.
  const [live] = await db
    .select()
    .from(paymentSession)
    .where(and(eq(paymentSession.paymentId, p.id), eq(paymentSession.status, 'pending')))
    .orderBy(desc(paymentSession.id))
    .limit(1);
  if (!live) throw new HttpError(409, 'There is no payment waiting for approval', 'NO_PENDING_SESSION');
  if (live.quoteExpiresAt <= new Date()) throw new HttpError(409, 'The quote expired; start the payment again', 'QUOTE_EXPIRED');
  if (!provider.verifyInteraction(live, hash, interactRef)) throw new HttpError(400, 'Invalid consent signature', 'INVALID_INTERACTION_HASH');
  const [claimed] = await db
    .update(paymentSession)
    .set({ status: 'processing' })
    .where(and(eq(paymentSession.id, live.id), eq(paymentSession.status, 'pending')))
    .returning();
  if (!claimed) return { status: 'processing', orderId };

  let result;
  try {
    result = await provider.complete({ session: claimed, hash, interactRef });
  } catch (err) {
    await db.update(paymentSession).set({ status: 'failed' }).where(eq(paymentSession.id, claimed.id));
    throw err;
  }
  await db.transaction(async (tx) => {
    await tx
      .insert(paymentEvent)
      .values({
        paymentId: p.id,
        providerEventId: `op:${result.outgoingPaymentId}`,
        type: result.status === 'paid' ? 'payment.captured' : 'payment.failed',
        payload: { sessionId: claimed.id, outgoingPaymentId: result.outgoingPaymentId },
        processedAt: new Date(),
      })
      .onConflictDoNothing();
    await tx
      .update(paymentSession)
      .set({ status: result.status === 'paid' ? 'completed' : 'failed', outgoingPaymentId: result.outgoingPaymentId })
      .where(eq(paymentSession.id, claimed.id));
    const [fresh] = await tx.select().from(payment).where(eq(payment.id, p.id));
    if (result.status === 'paid') await capture(tx, fresh);
    else await fail(tx, fresh);
  });
  return { status: result.status, orderId };
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
  if (!provider.verifyWebhook) throw new HttpError(404, 'Not found', 'NOT_FOUND');
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
