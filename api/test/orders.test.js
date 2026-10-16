import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq, like } from 'drizzle-orm';
import request from 'supertest';
import app from '../src/app.js';
import { db, pool } from '../src/db/index.js';
import { user } from '../src/db/schema.js';
import { item } from '../src/db/catalog.js';
import { order } from '../src/db/orders.js';
import { transitionOrder } from '../src/services/orderStateMachine.js';
import { cancelExpiredOrders } from '../src/services/orderService.js';
import { authed, newBuyer, newSeller, uniq } from './helpers.js';

const D = 'orderstest.local';
const api = '/api/v1';
const key = () => `key-${uniq()}-abcdefgh`;

after(async () => {
  await db.delete(user).where(like(user.email, `%@${D}`));
  await pool.end();
});

async function setup({ stock = 10, price = 1000 } = {}) {
  const seller = await newSeller(D);
  const create = (extra) =>
    authed(request(app).post(`${api}/seller/items`), seller.token).send({ sku: `S-${uniq()}`, name: 'Galleta', priceAmount: price, status: 'active', initialStock: stock, ...extra });
  const it = (await create()).body.item;
  const buyer = await newBuyer(D);
  return { seller, it, create, buyer };
}
const add = (buyer, itemId, quantity) => authed(request(app).put(`${api}/cart/items/${itemId}`), buyer.token).send({ quantity });
const checkout = (buyer, k = key()) => authed(request(app).post(`${api}/orders`), buyer.token).set('Idempotency-Key', k);
const available = async (id) => (await request(app).get(`${api}/items/${id}`)).body.item.available;
const asSystem = (orderId, to) => db.transaction((tx) => transitionOrder(tx, orderId, to, { actor: 'system' }));

test('cart: add, price with discounts, validate stock, single store, remove and clear', async () => {
  const { seller, it, buyer, create } = await setup({ stock: 5 });
  await authed(request(app).post(`${api}/seller/items/${it.id}/discounts`), seller.token).send({ type: 'percent', value: 1000 });

  const res = await add(buyer, it.id, 3);
  assert.equal(res.status, 200);
  const c = res.body.cart;
  assert.equal(c.currency, 'USD');
  assert.equal(c.lines[0].unitAmount, 900);
  assert.equal(c.subtotalAmount, 3000);
  assert.equal(c.discountAmount, 300);
  assert.equal(c.totalAmount, 2700);

  assert.equal((await add(buyer, it.id, 6)).body.error.code, 'INSUFFICIENT_STOCK');
  assert.equal((await add(buyer, it.id, 0)).body.error.code, 'INVALID_QUANTITY');
  assert.equal((await add(buyer, 999999, 1)).status, 404);
  const draft = (await create({ status: 'draft' })).body.item;
  assert.equal((await add(buyer, draft.id, 1)).status, 404);

  const other = await newSeller(D);
  const foreign = (await authed(request(app).post(`${api}/seller/items`), other.token).send({ sku: 'X-1', name: 'Otro', priceAmount: 5, status: 'active', initialStock: 1 })).body.item;
  assert.equal((await add(buyer, foreign.id, 1)).body.error.code, 'CART_OTHER_STORE');

  assert.equal((await add(buyer, it.id, 1)).body.cart.lines[0].quantity, 1); // reemplaza la cantidad
  assert.equal((await authed(request(app).delete(`${api}/cart/items/${it.id}`), buyer.token)).body.cart.lines.length, 0);
  assert.equal((await authed(request(app).delete(`${api}/cart/items/${it.id}`), buyer.token)).body.error.code, 'CART_ITEM_NOT_FOUND');
  await add(buyer, it.id, 2);
  assert.equal((await authed(request(app).delete(`${api}/cart`), buyer.token)).status, 204);
  assert.equal((await authed(request(app).get(`${api}/cart`), buyer.token)).body.cart.lines.length, 0);

  assert.equal((await request(app).get(`${api}/cart`)).status, 401);
  assert.equal((await authed(request(app).get(`${api}/cart`), seller.token)).status, 403);
});

test('checkout freezes prices, reserves stock, is idempotent and empties the cart', async () => {
  const { seller, it, buyer } = await setup({ stock: 10, price: 1000 });
  await authed(request(app).post(`${api}/seller/items/${it.id}/discounts`), seller.token).send({ type: 'percent', value: 1000 });
  assert.equal((await checkout(buyer)).body.error.code, 'CART_EMPTY');
  await add(buyer, it.id, 3);
  assert.equal((await authed(request(app).post(`${api}/orders`), buyer.token)).body.error.code, 'IDEMPOTENCY_KEY_REQUIRED');

  const k = key();
  const res = await checkout(buyer, k);
  assert.equal(res.status, 201);
  const o = res.body.order;
  assert.match(o.number, /^ORD-[0-9A-F]{10}$/);
  assert.equal(o.status, 'pending_payment');
  assert.equal(o.subtotalAmount, 3000);
  assert.equal(o.discountAmount, 300);
  assert.equal(o.totalAmount, 2700);
  assert.equal(o.commissionRate, 0.001);
  assert.equal(o.commissionAmount, 3); // 0.1 % de 2700 = 2.7 -> 3
  assert.equal(o.currency, 'USD');
  assert.equal(o.items[0].unitAmount, 900);
  assert.deepEqual(o.history.map((h) => [h.from, h.to]), [[null, 'pending_payment']]);
  assert.equal(await available(it.id), 7);

  const again = await checkout(buyer, k); // mismo intento repetido
  assert.equal(again.status, 200);
  assert.equal(again.body.order.id, o.id);
  assert.equal(await available(it.id), 7);
  assert.equal((await checkout(buyer)).body.error.code, 'CART_EMPTY'); // el carrito ya se convirtió

  await authed(request(app).patch(`${api}/seller/items/${it.id}`), seller.token).send({ priceAmount: 5000, name: 'Cambiado' });
  const stored = (await authed(request(app).get(`${api}/orders/${o.id}`), buyer.token)).body.order;
  assert.equal(stored.items[0].unitAmount, 900);
  assert.equal(stored.items[0].name, 'Galleta'); // la copia no cambia

  const parallel = await Promise.all([checkout(buyer, key()), checkout(buyer, key())]);
  assert.ok(parallel.every((r) => r.body.error?.code === 'CART_EMPTY'));
});

test('checkout fails as a whole when stock is not enough or an item stops being sold', async () => {
  const { seller, it, buyer } = await setup({ stock: 2 });
  await add(buyer, it.id, 2);
  await authed(request(app).post(`${api}/seller/items/${it.id}/stock`), seller.token).send({ type: 'adjustment', delta: -1, reason: 'merma' });
  const res = await checkout(buyer);
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'INSUFFICIENT_STOCK');
  assert.equal((await db.select().from(order).where(eq(order.buyerId, Number(buyer.user.id)))).length, 0);
  assert.equal((await authed(request(app).get(`${api}/cart`), buyer.token)).body.cart.lines.length, 1); // el carrito sigue

  await authed(request(app).patch(`${api}/seller/items/${it.id}`), seller.token).send({ status: 'inactive' });
  assert.equal((await checkout(buyer)).body.error.code, 'ITEM_UNAVAILABLE');
});

test('buyer cancels a pending order: stock is released and the history records it', async () => {
  const { it, buyer } = await setup({ stock: 4 });
  await add(buyer, it.id, 4);
  const o = (await checkout(buyer)).body.order;
  assert.equal(await available(it.id), 0);
  const res = await authed(request(app).post(`${api}/orders/${o.id}/cancel`), buyer.token);
  assert.equal(res.status, 200);
  assert.equal(res.body.order.status, 'cancelled');
  assert.deepEqual(res.body.order.history.map((h) => h.to), ['pending_payment', 'cancelled']);
  assert.equal(await available(it.id), 4);
  assert.equal((await authed(request(app).post(`${api}/orders/${o.id}/cancel`), buyer.token)).body.error.code, 'INVALID_TRANSITION');
});

test('orders are private: other buyers and other sellers get 404; lists filter and paginate', async () => {
  const { seller, it, buyer } = await setup({ stock: 10 });
  const ids = [];
  for (let i = 0; i < 3; i++) {
    await add(buyer, it.id, 1);
    ids.push((await checkout(buyer)).body.order.id);
  }
  await authed(request(app).post(`${api}/orders/${ids[0]}/cancel`), buyer.token);

  const p1 = await authed(request(app).get(`${api}/orders`).query({ limit: 2 }), buyer.token);
  assert.deepEqual(p1.body.orders.map((o) => o.id), [ids[2], ids[1]]);
  const p2 = await authed(request(app).get(`${api}/orders`).query({ limit: 2, cursor: p1.body.nextCursor }), buyer.token);
  assert.deepEqual(p2.body.orders.map((o) => o.id), [ids[0]]);
  assert.equal((await authed(request(app).get(`${api}/orders`).query({ status: 'cancelled' }), buyer.token)).body.orders.length, 1);
  assert.equal((await authed(request(app).get(`${api}/orders`).query({ status: 'nope' }), buyer.token)).body.error.code, 'INVALID_STATUS');

  const stranger = await newBuyer(D);
  assert.equal((await authed(request(app).get(`${api}/orders/${ids[1]}`), stranger.token)).status, 404);
  assert.equal((await authed(request(app).post(`${api}/orders/${ids[1]}/cancel`), stranger.token)).status, 404);
  assert.equal((await authed(request(app).get(`${api}/orders/abc`), buyer.token)).status, 404);

  const mine = await authed(request(app).get(`${api}/seller/orders`), seller.token);
  assert.equal(mine.body.orders.length, 3);
  assert.equal((await authed(request(app).get(`${api}/seller/orders/${ids[1]}`), seller.token)).body.order.items.length, 1);
  const otherSeller = await newSeller(D);
  assert.equal((await authed(request(app).get(`${api}/seller/orders/${ids[1]}`), otherSeller.token)).status, 404);
  assert.equal((await authed(request(app).get(`${api}/seller/orders`), otherSeller.token)).body.orders.length, 0);
  assert.equal((await authed(request(app).get(`${api}/seller/orders`), buyer.token)).status, 403);
});

test('seller flow: paid -> preparing -> completed; invalid jumps are refused; paid cancel restocks', async () => {
  const { seller, it, buyer } = await setup({ stock: 6 });
  await add(buyer, it.id, 2);
  const o = (await checkout(buyer)).body.order;
  const status = (id, body) => authed(request(app).post(`${api}/seller/orders/${id}/status`), seller.token).send(body);

  assert.equal((await status(o.id, { status: 'preparing' })).body.error.code, 'INVALID_TRANSITION'); // aún sin pagar
  assert.equal((await status(o.id, { status: 'paid' })).body.error.code, 'INVALID_STATUS'); // el seller no marca pagos

  await asSystem(o.id, 'paid'); // lo hará la confirmación del pago
  const ledger = await authed(request(app).get(`${api}/seller/items/${it.id}/stock`), seller.token);
  assert.equal(ledger.body.stock.currentStock, 4);
  assert.equal(ledger.body.stock.reserved, 0);

  assert.equal((await status(o.id, { status: 'completed' })).body.error.code, 'INVALID_TRANSITION');
  assert.equal((await status(o.id, { status: 'preparing', note: 'En el horno' })).body.order.status, 'preparing');
  assert.equal((await authed(request(app).post(`${api}/orders/${o.id}/cancel`), buyer.token)).body.error.code, 'INVALID_TRANSITION'); // el buyer ya no cancela

  const cancelled = await status(o.id, { status: 'cancelled', note: 'Sin ingredientes' });
  assert.equal(cancelled.body.order.status, 'cancelled');
  assert.equal(await available(it.id), 6); // el stock vendido vuelve
  assert.equal((await authed(request(app).get(`${api}/seller/items/${it.id}/stock`), seller.token)).body.stock.consistent, true);
  assert.deepEqual(cancelled.body.order.history.map((h) => h.to), ['pending_payment', 'paid', 'preparing', 'cancelled']);

  await add(buyer, it.id, 1);
  const o2 = (await checkout(buyer)).body.order;
  await asSystem(o2.id, 'paid');
  await status(o2.id, { status: 'preparing' });
  assert.equal((await status(o2.id, { status: 'completed' })).body.order.status, 'completed');
  assert.equal((await status(o2.id, { status: 'cancelled' })).body.error.code, 'INVALID_TRANSITION');
});

test('orders left unpaid past their deadline are cancelled and release stock', async () => {
  const { it, buyer } = await setup({ stock: 3 });
  await add(buyer, it.id, 3);
  const o = (await checkout(buyer)).body.order;
  assert.equal(await available(it.id), 0);
  await db.update(order).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(order.id, o.id));
  assert.ok((await cancelExpiredOrders()) >= 1);
  const after = (await authed(request(app).get(`${api}/orders/${o.id}`), buyer.token)).body.order;
  assert.equal(after.status, 'cancelled');
  assert.equal(after.history.at(-1).note, 'Payment timeout');
  assert.equal(after.history.at(-1).actorId, null);
  assert.equal(await available(it.id), 3);
});

test('two buyers racing for the last unit: exactly one order is created', async () => {
  const { it, buyer } = await setup({ stock: 1 });
  const rival = await newBuyer(D);
  await add(buyer, it.id, 1);
  await add(rival, it.id, 1);
  const [a, b] = await Promise.all([checkout(buyer), checkout(rival)]);
  assert.deepEqual([a.status, b.status].sort(), [201, 409]);
  assert.equal(await db.select().from(item).where(eq(item.id, it.id)).then((r) => r[0].currentStock), 1);
  assert.equal(await available(it.id), 0);
});
