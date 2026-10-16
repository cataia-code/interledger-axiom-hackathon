import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq, like } from 'drizzle-orm';
import request from 'supertest';
import app from '../src/app.js';
import { config } from '../src/config/index.js';
import { db, pool } from '../src/db/index.js';
import { user } from '../src/db/schema.js';
import { order } from '../src/db/orders.js';
import { stockReservation } from '../src/db/inventory.js';
import { authed, newBuyer, newSeller, uniq } from './helpers.js';

const D = 'paymentstest.local';
const api = '/api/v1';
const key = () => `key-${uniq()}-abcdefgh`;

after(async () => {
  await db.delete(user).where(like(user.email, `%@${D}`));
  await pool.end();
});

// Seller con un ítem de 1000 y un pedido pendiente de `qty` unidades del buyer.
async function pendingOrder({ stock = 10, qty = 1 } = {}) {
  const seller = await newSeller(D);
  const it = (
    await authed(request(app).post(`${api}/seller/items`), seller.token).send({ sku: `S-${uniq()}`, name: 'Galleta', priceAmount: 1000, status: 'active', initialStock: stock })
  ).body.item;
  const buyer = await newBuyer(D);
  await authed(request(app).put(`${api}/cart/items/${it.id}`), buyer.token).send({ quantity: qty });
  const o = (await authed(request(app).post(`${api}/orders`), buyer.token).set('Idempotency-Key', key())).body.order;
  return { seller, buyer, it, o };
}
const pay = (buyer, orderId, k = key()) => authed(request(app).post(`${api}/orders/${orderId}/pay`), buyer.token).set('Idempotency-Key', k);
const hook = (body, secret = config.paymentWebhookSecret) => request(app).post(`${api}/payments/webhook/placeholder`).set('X-Webhook-Secret', secret).send(body);
const event = (type, providerRef) => ({ eventId: `evt-${uniq()}`, type, providerRef });
const getOrder = async (buyer, id) => (await authed(request(app).get(`${api}/orders/${id}`), buyer.token)).body.order;
const stockOf = async (seller, itemId) => (await authed(request(app).get(`${api}/seller/items/${itemId}/stock`), seller.token)).body.stock;
const sellerStatus = (seller, id, status) => authed(request(app).post(`${api}/seller/orders/${id}/status`), seller.token).send({ status });

test('paying: needs a key, belongs to the buyer, is idempotent and never duplicates a pending payment', async () => {
  const { buyer, o } = await pendingOrder({ qty: 2 });
  assert.equal((await authed(request(app).post(`${api}/orders/${o.id}/pay`), buyer.token)).body.error.code, 'IDEMPOTENCY_KEY_REQUIRED');
  assert.equal((await pay(await newBuyer(D), o.id)).status, 404);

  const k = key();
  const first = await pay(buyer, o.id, k);
  assert.equal(first.status, 201);
  assert.equal(first.body.payment.status, 'pending');
  assert.equal(first.body.payment.amount, 2000);
  assert.equal(first.body.payment.currency, 'USD');
  assert.equal(first.body.payment.provider, 'placeholder');
  assert.match(first.body.payment.providerRef, /^ph_/);

  const again = await pay(buyer, o.id, k);
  assert.equal(again.status, 200);
  assert.equal(again.body.payment.id, first.body.payment.id);
  const other = await pay(buyer, o.id); // otra clave, pero ya hay un cobro pendiente
  assert.equal(other.status, 200);
  assert.equal(other.body.payment.id, first.body.payment.id);

  const list = await authed(request(app).get(`${api}/orders/${o.id}/payments`), buyer.token);
  assert.equal(list.body.payments.length, 1);
});

test('webhook: validates the secret and the event, confirms the payment once and moves stock', async () => {
  const { seller, buyer, it, o } = await pendingOrder({ stock: 5, qty: 2 });
  const p = (await pay(buyer, o.id)).body.payment;

  assert.equal((await hook(event('payment.captured', p.providerRef), 'wrong-secret')).status, 401);
  assert.equal((await hook({ type: 'nope' })).status, 400);
  assert.equal((await getOrder(buyer, o.id)).status, 'pending_payment');

  const evt = event('payment.captured', p.providerRef);
  const ok = await hook(evt);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.status, 'processed');
  const paid = await getOrder(buyer, o.id);
  assert.equal(paid.status, 'paid');
  assert.deepEqual(paid.history.map((h) => h.to), ['pending_payment', 'paid']);
  const stock = await stockOf(seller, it.id);
  assert.deepEqual([stock.currentStock, stock.reserved, stock.consistent], [3, 0, true]);
  const payments = (await authed(request(app).get(`${api}/orders/${o.id}/payments`), buyer.token)).body.payments;
  assert.equal(payments[0].status, 'captured');

  assert.equal((await hook(evt)).body.status, 'duplicate'); // mismo evento reenviado
  assert.equal((await stockOf(seller, it.id)).currentStock, 3);
  assert.equal((await hook(event('payment.captured', 'ph_unknown'))).body.status, 'ignored');
  assert.equal((await pay(buyer, o.id)).status, 409); // ya no se puede pagar
  assert.equal((await pay(buyer, o.id)).body.error.code, 'ORDER_NOT_PAYABLE');
});

test('a failed payment keeps the order pending so the buyer can retry', async () => {
  const { buyer, o } = await pendingOrder();
  const first = (await pay(buyer, o.id)).body.payment;
  await hook(event('payment.failed', first.providerRef));
  assert.equal((await getOrder(buyer, o.id)).status, 'pending_payment');
  const retry = await pay(buyer, o.id);
  assert.equal(retry.status, 201);
  assert.notEqual(retry.body.payment.id, first.id);
  await hook(event('payment.captured', retry.body.payment.providerRef));
  assert.equal((await getOrder(buyer, o.id)).status, 'paid');
  const statuses = (await authed(request(app).get(`${api}/orders/${o.id}/payments`), buyer.token)).body.payments.map((x) => x.status);
  assert.deepEqual(statuses, ['failed', 'captured']);
});

test('late money is refunded: capture after the order was cancelled, or after the stock ran out', async () => {
  const a = await pendingOrder();
  const pa = (await pay(a.buyer, a.o.id)).body.payment;
  await authed(request(app).post(`${api}/orders/${a.o.id}/cancel`), a.buyer.token);
  let payments = (await authed(request(app).get(`${api}/orders/${a.o.id}/payments`), a.buyer.token)).body.payments;
  assert.equal(payments[0].status, 'cancelled');
  await hook(event('payment.captured', pa.providerRef)); // el proveedor igual cobró
  assert.equal((await getOrder(a.buyer, a.o.id)).status, 'cancelled');
  payments = (await authed(request(app).get(`${api}/orders/${a.o.id}/payments`), a.buyer.token)).body.payments;
  assert.equal(payments[0].status, 'refunded');
  assert.equal(payments[0].refunds[0].amount, 1000);

  const b = await pendingOrder({ stock: 1 });
  const pb = (await pay(b.buyer, b.o.id)).body.payment;
  await db.update(stockReservation).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(stockReservation.orderId, b.o.id));
  await authed(request(app).post(`${api}/seller/items/${b.it.id}/stock`), b.seller.token).send({ type: 'adjustment', delta: -1, reason: 'se vendió en tienda' });
  await hook(event('payment.captured', pb.providerRef));
  assert.equal((await getOrder(b.buyer, b.o.id)).status, 'cancelled');
  payments = (await authed(request(app).get(`${api}/orders/${b.o.id}/payments`), b.buyer.token)).body.payments;
  assert.equal(payments[0].status, 'refunded');
  assert.equal((await stockOf(b.seller, b.it.id)).consistent, true);
});

test('cancelling a paid order refunds it fully and returns the stock', async () => {
  const { seller, buyer, it, o } = await pendingOrder({ stock: 4, qty: 3 });
  await hook(event('payment.captured', (await pay(buyer, o.id)).body.payment.providerRef));
  assert.equal((await stockOf(seller, it.id)).currentStock, 1);
  const res = await authed(request(app).post(`${api}/orders/${o.id}/cancel`), buyer.token);
  assert.equal(res.body.order.status, 'cancelled');
  assert.equal((await stockOf(seller, it.id)).currentStock, 4);
  const payments = (await authed(request(app).get(`${api}/orders/${o.id}/payments`), buyer.token)).body.payments;
  assert.equal(payments[0].status, 'refunded');
  assert.equal(payments[0].refunds[0].amount, 3000);
});

test('seller refunds: partial any time, never above what was paid, full only on a completed order', async () => {
  const { seller, buyer, o } = await pendingOrder({ qty: 1 });
  const refundUrl = `${api}/seller/orders/${o.id}/refunds`;
  assert.equal((await authed(request(app).post(refundUrl), seller.token).send({})).body.error.code, 'PAYMENT_NOT_REFUNDABLE'); // aún sin pagar

  await hook(event('payment.captured', (await pay(buyer, o.id)).body.payment.providerRef));
  assert.equal((await authed(request(app).post(refundUrl), seller.token).send({ amount: 0 })).body.error.code, 'INVALID_AMOUNT');
  assert.equal((await authed(request(app).post(refundUrl), seller.token).send({ amount: 1001 })).body.error.code, 'INVALID_AMOUNT');
  assert.equal((await authed(request(app).post(refundUrl), seller.token).send({})).body.error.code, 'USE_CANCEL'); // total sin completar

  const partial = await authed(request(app).post(refundUrl), seller.token).send({ amount: 400, reason: 'Una galleta rota' });
  assert.equal(partial.status, 201);
  assert.equal(partial.body.payments[0].status, 'partially_refunded');
  assert.equal(partial.body.refund.amount, 400);

  await sellerStatus(seller, o.id, 'preparing');
  await sellerStatus(seller, o.id, 'completed');
  assert.equal((await authed(request(app).post(refundUrl), seller.token).send({ amount: 700 })).body.error.code, 'INVALID_AMOUNT'); // solo quedan 600
  const rest = await authed(request(app).post(refundUrl), seller.token).send({});
  assert.equal(rest.status, 201);
  assert.equal(rest.body.refund.amount, 600);
  assert.equal(rest.body.payments[0].status, 'refunded');
  const finalOrder = await getOrder(buyer, o.id);
  assert.equal(finalOrder.status, 'refunded');
  assert.equal(finalOrder.history.at(-1).to, 'refunded');

  const mine = await authed(request(app).get(`${api}/seller/orders/${o.id}/payments`), seller.token);
  assert.equal(mine.body.payments[0].refunds.length, 2);
  const stranger = await newSeller(D);
  assert.equal((await authed(request(app).post(refundUrl), stranger.token).send({})).status, 404);
  assert.equal((await authed(request(app).get(`${api}/seller/orders/${o.id}/payments`), stranger.token)).status, 404);
});

test('two concurrent partial refunds cannot exceed the amount paid', async () => {
  const { seller, buyer, o } = await pendingOrder();
  await hook(event('payment.captured', (await pay(buyer, o.id)).body.payment.providerRef));
  const url = `${api}/seller/orders/${o.id}/refunds`;
  const results = await Promise.all([
    authed(request(app).post(url), seller.token).send({ amount: 700 }),
    authed(request(app).post(url), seller.token).send({ amount: 700 }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  assert.equal(results.find((r) => r.status === 409).body.error.code, 'REFUND_EXCEEDS_PAYMENT');
  const [row] = await db.select().from(order).where(eq(order.id, o.id));
  assert.equal(row.status, 'paid');
});
