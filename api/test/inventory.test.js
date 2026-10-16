import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq, like } from 'drizzle-orm';
import request from 'supertest';
import app from '../src/app.js';
import { db, pool } from '../src/db/index.js';
import { user } from '../src/db/schema.js';
import { item } from '../src/db/catalog.js';
import { stockReservation } from '../src/db/inventory.js';
import { order } from '../src/db/orders.js';
import { applyStockMovement, confirmReservations, expireReservations, releaseReservations, reserveStock, restockOrder } from '../src/services/stockService.js';
import { authed, newBuyer, newSeller, uniq } from './helpers.js';

const D = 'inventorytest.local';
const api = '/api/v1';
const newItem = async (token, extra = {}) =>
  (await authed(request(app).post(`${api}/seller/items`), token).send({ sku: `S-${uniq()}`, name: 'Galleta', priceAmount: 500, status: 'active', ...extra })).body.item;
const stockOf = async (id) => (await db.select().from(item).where(eq(item.id, id)))[0].currentStock;
// Pedido mínimo real para satisfacer las claves foráneas de reservas y movimientos.
const host = { buyer: await newBuyer(D), seller: await newSeller(D) };
const orderId = async () => {
  const [row] = await db
    .insert(order)
    .values({
      number: `T-${uniq()}`,
      buyerId: Number(host.buyer.user.id),
      storeId: host.seller.store.id,
      subtotalAmount: 0,
      discountAmount: 0,
      totalAmount: 0,
      commissionRate: 0.001,
      commissionAmount: 0,
      currency: 'USD',
      idempotencyKey: `k-${uniq()}`,
      expiresAt: new Date(Date.now() + 3_600_000),
    })
    .returning();
  return row.id;
};

after(async () => {
  await db.delete(user).where(like(user.email, `%@${D}`));
  await pool.end();
});

test('initial stock, restock and adjustments keep current_stock equal to the ledger', async () => {
  const { token } = await newSeller(D);
  const it = await newItem(token, { initialStock: 10 });
  assert.equal(it.currentStock, 10);
  assert.equal(it.available, 10);

  const url = `${api}/seller/items/${it.id}`;
  const restock = await authed(request(app).post(`${url}/stock`), token).send({ type: 'restock', quantity: 5, reason: 'Compra' });
  assert.equal(restock.status, 201);
  assert.equal(restock.body.movement.stockAfter, 15);
  const adj = await authed(request(app).post(`${url}/stock`), token).send({ type: 'adjustment', delta: -3, reason: 'Merma' });
  assert.equal(adj.body.stock.currentStock, 12);

  const summary = await authed(request(app).get(`${url}/stock`), token);
  assert.deepEqual(
    { currentStock: 12, reserved: 0, available: 12, movementsTotal: 12, consistent: true },
    { currentStock: summary.body.stock.currentStock, reserved: summary.body.stock.reserved, available: summary.body.stock.available, movementsTotal: summary.body.stock.movementsTotal, consistent: summary.body.stock.consistent },
  );

  const history = await authed(request(app).get(`${url}/stock-movements`).query({ limit: 2 }), token);
  assert.equal(history.body.movements.length, 2);
  assert.equal(history.body.movements[0].type, 'adjustment'); // más reciente primero
  assert.ok(history.body.nextCursor);
  const rest = await authed(request(app).get(`${url}/stock-movements`).query({ cursor: history.body.nextCursor }), token);
  assert.deepEqual(rest.body.movements.map((m) => m.type), ['initial']);
});

test('stock inputs are validated and stock never goes negative', async () => {
  const { token } = await newSeller(D);
  const it = await newItem(token, { initialStock: 2 });
  const post = (body) => authed(request(app).post(`${api}/seller/items/${it.id}/stock`), token).send(body);
  assert.equal((await post({ type: 'sale', quantity: 1 })).body.error.code, 'INVALID_MOVEMENT_TYPE');
  assert.equal((await post({ type: 'restock', quantity: 0 })).body.error.code, 'INVALID_QUANTITY');
  assert.equal((await post({ type: 'adjustment', delta: -1 })).body.error.code, 'REASON_REQUIRED');
  assert.equal((await post({ type: 'adjustment', delta: 0, reason: 'x' })).body.error.code, 'INVALID_QUANTITY');
  const over = await post({ type: 'adjustment', delta: -3, reason: 'conteo' });
  assert.equal(over.status, 409);
  assert.equal(over.body.error.code, 'INSUFFICIENT_STOCK');
  assert.equal(await stockOf(it.id), 2);
  const bad = await authed(request(app).post(`${api}/seller/items`), token).send({ sku: `S-${uniq()}`, name: 'Galleta', priceAmount: 5, initialStock: -1 });
  assert.equal(bad.body.error.code, 'INVALID_STOCK');

  const other = await newSeller(D);
  assert.equal((await authed(request(app).post(`${api}/seller/items/${it.id}/stock`), other.token).send({ type: 'restock', quantity: 1 })).status, 403);
  const buyer = await newBuyer(D);
  assert.equal((await authed(request(app).get(`${api}/seller/items/${it.id}/stock`), buyer.token)).status, 403);
});

test('the public view shows availability, not the real stock', async () => {
  const { token } = await newSeller(D);
  const it = await newItem(token, { initialStock: 4 });
  const pub = (await request(app).get(`${api}/items/${it.id}`)).body.item;
  assert.equal(pub.available, 4);
  assert.equal(pub.currentStock, undefined);
  assert.equal(pub.reserved, undefined);
  const held = await orderId();
  await db.transaction((tx) => reserveStock(tx, { orderId: held, lines: [{ itemId: it.id, quantity: 3 }] }));
  assert.equal((await request(app).get(`${api}/items/${it.id}`)).body.item.available, 1);
  const own = (await authed(request(app).get(`${api}/seller/items/${it.id}`), token)).body.item;
  assert.equal(own.currentStock, 4);
  assert.equal(own.reserved, 3);
});

test('reservations: all-or-nothing, release, confirm to sale, restock on cancel', async () => {
  const { token } = await newSeller(D);
  const a = await newItem(token, { initialStock: 5 });
  const b = await newItem(token, { initialStock: 1 });
  const o = await orderId();

  await assert.rejects(
    db.transaction((tx) => reserveStock(tx, { orderId: o, lines: [{ itemId: a.id, quantity: 2 }, { itemId: b.id, quantity: 2 }] })),
    { code: 'INSUFFICIENT_STOCK' },
  );
  assert.equal((await db.select().from(stockReservation).where(eq(stockReservation.orderId, o))).length, 0); // nada quedó reservado

  await db.transaction((tx) => reserveStock(tx, { orderId: o, lines: [{ itemId: a.id, quantity: 2 }, { itemId: b.id, quantity: 1 }] }));
  assert.equal(await db.transaction((tx) => releaseReservations(tx, o)), 2);
  assert.equal(await stockOf(a.id), 5); // liberar no toca el stock

  const o2 = await orderId();
  await db.transaction((tx) => reserveStock(tx, { orderId: o2, lines: [{ itemId: a.id, quantity: 2 }, { itemId: b.id, quantity: 1 }] }));
  await db.transaction((tx) => confirmReservations(tx, o2));
  assert.equal(await stockOf(a.id), 3);
  assert.equal(await stockOf(b.id), 0);
  const sale = (await authed(request(app).get(`${api}/seller/items/${a.id}/stock-movements`), token)).body.movements[0];
  assert.equal(sale.type, 'sale');
  assert.equal(sale.orderId, o2);

  await db.transaction((tx) => restockOrder(tx, o2, 'Pedido cancelado'));
  assert.equal(await stockOf(a.id), 5);
  assert.equal(await stockOf(b.id), 1);
  assert.equal((await authed(request(app).get(`${api}/seller/items/${a.id}/stock`), token)).body.stock.consistent, true);
});

test('expired reservations stop holding stock and are marked by the job', async () => {
  const { token } = await newSeller(D);
  const it = await newItem(token, { initialStock: 1 });
  const o = await orderId();
  await db.transaction((tx) => reserveStock(tx, { orderId: o, lines: [{ itemId: it.id, quantity: 1 }], ttlMinutes: -1 }));
  assert.equal((await request(app).get(`${api}/items/${it.id}`)).body.item.available, 1); // ya vencida: no retiene
  const again = await orderId();
  await db.transaction((tx) => reserveStock(tx, { orderId: again, lines: [{ itemId: it.id, quantity: 1 }] })); // se puede reservar de nuevo
  const expired = await expireReservations();
  assert.ok(expired.some((r) => r.orderId === o));
  assert.equal((await db.select().from(stockReservation).where(eq(stockReservation.orderId, o)))[0].status, 'expired');
});

test('concurrency: the last unit can only be reserved once, and sales never oversell', async () => {
  const { token } = await newSeller(D);
  const last = await newItem(token, { initialStock: 1 });
  const orderIds = await Promise.all(Array.from({ length: 6 }, () => orderId()));
  const results = await Promise.allSettled(
    orderIds.map((id) => db.transaction((tx) => reserveStock(tx, { orderId: id, lines: [{ itemId: last.id, quantity: 1 }] }))),
  );
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.ok(results.filter((r) => r.status === 'rejected').every((r) => r.reason.code === 'INSUFFICIENT_STOCK'));

  const many = await newItem(token, { initialStock: 5 });
  const sales = await Promise.allSettled(
    Array.from({ length: 12 }, () => db.transaction((tx) => applyStockMovement(tx, { itemId: many.id, type: 'adjustment', delta: -1, reason: 'test' }))),
  );
  assert.equal(sales.filter((r) => r.status === 'fulfilled').length, 5);
  assert.equal(await stockOf(many.id), 0);
  assert.equal((await authed(request(app).get(`${api}/seller/items/${many.id}/stock`), token)).body.stock.consistent, true);
});
