import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { like } from 'drizzle-orm';
import request from 'supertest';
import app from '../src/app.js';
import { db, pool } from '../src/db/index.js';
import { user } from '../src/db/schema.js';
import { transitionOrder } from '../src/services/orderStateMachine.js';
import { computeScore, confidenceOf, levelOf } from '../src/services/statsService.js';
import { authed, newBuyer, newSeller, uniq } from './helpers.js';

const D = 'statstest.local';
const api = '/api/v1';

after(async () => {
  await db.delete(user).where(like(user.email, `%@${D}`));
  await pool.end();
});

const base = { activeItems: 0, itemsInStock: 0, itemsWithImages: 0, ordersCompleted: 0, ordersCancelled: 0, ordersRefunded: 0, unitsSold: 0, uniqueBuyers: 0, ordersLast30d: 0, stockMovementsLast30d: 0, profilePoints: 0 };

test('the score formula matches the three documented examples', () => {
  const established = computeScore({ ...base, activeItems: 8, itemsInStock: 8, itemsWithImages: 8, ordersCompleted: 24, ordersCancelled: 2, ordersRefunded: 1, unitsSold: 61, uniqueBuyers: 15, ordersLast30d: 9, stockMovementsLast30d: 14, profilePoints: 2 });
  assert.deepEqual([established.score, established.stars], [81, 4]);
  assert.deepEqual(established.breakdown, { catalog: 21, sales: 33.7, reliability: 17.3, activity: 8.8 });
  assert.equal(levelOf(established.score, established.finishedOrders), 'gold');
  assert.equal(confidenceOf(established.finishedOrders), 'high');

  const fresh = computeScore({ ...base, activeItems: 5, itemsInStock: 5, itemsWithImages: 5, profilePoints: 2 });
  assert.deepEqual([fresh.score, fresh.stars], [34, 1.7]);
  assert.equal(levelOf(fresh.score, fresh.finishedOrders), 'new');
  assert.equal(confidenceOf(fresh.finishedOrders), 'low');

  const troubled = computeScore({ ...base, activeItems: 12, itemsInStock: 7, itemsWithImages: 6, ordersCompleted: 6, ordersCancelled: 9, ordersRefunded: 3, unitsSold: 14, uniqueBuyers: 5, ordersLast30d: 2, stockMovementsLast30d: 3, profilePoints: 1 });
  assert.deepEqual([troubled.score, troubled.stars], [47, 2.4]);
  assert.equal(levelOf(troubled.score, troubled.finishedOrders), 'silver');

  // Límites: nunca pasa de 100 ni baja de 0, y los niveles cambian en sus umbrales.
  const maxed = computeScore({ ...base, activeItems: 99, itemsInStock: 99, itemsWithImages: 99, ordersCompleted: 999, unitsSold: 9999, uniqueBuyers: 99, ordersLast30d: 99, stockMovementsLast30d: 99, profilePoints: 2 });
  assert.ok(maxed.score <= 100 && maxed.score >= 95);
  assert.equal(levelOf(85, 10), 'platinum');
  assert.equal(levelOf(84, 10), 'gold');
  assert.equal(levelOf(64, 10), 'silver');
  assert.equal(levelOf(39, 10), 'bronze');
  assert.equal(levelOf(99, 2), 'new');
  assert.equal(confidenceOf(5), 'medium');
  assert.equal(confidenceOf(20), 'high');
});

// Seller con ítems y pedidos de distintos estados.
async function storeWithOrders() {
  const seller = await newSeller(D);
  const mk = async (extra) =>
    (await authed(request(app).post(`${api}/seller/items`), seller.token).send({ sku: `S-${uniq()}`, name: 'Galleta', priceAmount: 1000, status: 'active', initialStock: 50, ...extra })).body.item;
  const a = await mk();
  const b = await mk({ initialStock: 3 }); // stock bajo
  await mk({ status: 'draft' });
  const buyer1 = await newBuyer(D);
  const buyer2 = await newBuyer(D);

  const orderFor = async (buyer, itemId, quantity) => {
    await authed(request(app).put(`${api}/cart/items/${itemId}`), buyer.token).send({ quantity });
    return (await authed(request(app).post(`${api}/orders`), buyer.token).set('Idempotency-Key', `key-${uniq()}-abcdefgh`)).body.order;
  };
  const move = (id, to, actor) => db.transaction((tx) => transitionOrder(tx, id, to, { actor }));
  const complete = async (o) => {
    await move(o.id, 'paid', 'system');
    await move(o.id, 'preparing', 'seller');
    await move(o.id, 'completed', 'seller');
  };

  await complete(await orderFor(buyer1, a.id, 2)); // 2000
  await complete(await orderFor(buyer1, a.id, 3)); // 3000 → comprador que repite
  const cancelled = await orderFor(buyer2, a.id, 1);
  await move(cancelled.id, 'cancelled', 'buyer');
  await orderFor(buyer2, b.id, 1); // sigue pendiente de pago
  return { seller, a, b, buyer1 };
}

test('public store stats count items and orders, expose no money and are cacheable', async () => {
  const { seller } = await storeWithOrders();
  const res = await request(app).get(`${api}/stores/${seller.store.id}/stats`);
  assert.equal(res.status, 200);
  assert.match(res.headers['cache-control'], /max-age=60/);
  const s = res.body.stats;
  assert.equal(s.storeId, seller.store.id);
  assert.deepEqual(s.metrics, {
    activeItems: 2, itemsInStock: 2, itemsWithImages: 0,
    ordersCompleted: 2, ordersCancelled: 1, ordersRefunded: 0, completionRate: 0.67,
    unitsSold: 5, uniqueBuyers: 1, repeatBuyers: 1, ordersLast30d: 4, memberSinceDays: 0,
  });
  assert.equal(s.level, 'bronze'); // 3 pedidos terminados: ya no es "new", pero el puntaje es bajo
  assert.equal(s.confidence, 'low'); // menos de 5 terminados
  assert.ok(s.score > 0 && s.score <= 100);
  assert.ok(Math.abs(s.stars - s.score / 20) <= 0.1, 'stars is the score over 20');
  assert.deepEqual(Object.keys(s.breakdown), ['catalog', 'sales', 'reliability', 'activity']);
  assert.equal(JSON.stringify(res.body).includes('Amount'), false, 'no money in the public view');
  assert.equal(res.body.stats.sales, undefined);

  assert.equal((await request(app).get(`${api}/stores/999999/stats`)).body.error.code, 'STORE_NOT_FOUND');
});

test('seller stats add sales, orders by status and alerts, and are private', async () => {
  const { seller } = await storeWithOrders();
  const res = await authed(request(app).get(`${api}/seller/stats`), seller.token);
  assert.equal(res.status, 200);
  assert.equal(res.headers['cache-control'], 'private, no-store');
  const s = res.body.stats;
  assert.deepEqual(s.sales, { currency: 'USD', completedAmount: 5000, last30dAmount: 5000, averageOrderAmount: 2500, refundedAmount: 0 });
  assert.deepEqual(s.ordersByStatus, { pending_payment: 1, paid: 0, preparing: 0, completed: 2, cancelled: 1, refunded: 0 });
  assert.deepEqual(s.alerts, { lowStockItems: 1, itemsWithoutImages: 2, draftItems: 1 });
  assert.ok(s.tips.some((t) => t.includes('fotos')));
  assert.ok(s.tips.some((t) => t.includes('banner')));
  assert.equal(s.metrics.ordersCompleted, 2);

  assert.equal((await request(app).get(`${api}/seller/stats`)).status, 401);
  const buyer = await newBuyer(D);
  assert.equal((await authed(request(app).get(`${api}/seller/stats`), buyer.token)).status, 403);
});

test('a store with nothing gets zeros, a neutral reliability and no completion rate', async () => {
  const seller = await newSeller(D);
  const s = (await request(app).get(`${api}/stores/${seller.store.id}/stats`)).body.stats;
  assert.equal(s.metrics.completionRate, null);
  assert.equal(s.metrics.activeItems, 0);
  assert.equal(s.breakdown.sales, 0);
  assert.equal(s.breakdown.reliability, 13.3);
  assert.equal(s.level, 'new');
});

test('general stats: totals, order breakdown and a ranking of top stores', async () => {
  const { seller } = await storeWithOrders();
  const res = await request(app).get(`${api}/stats`).query({ limit: 20 });
  assert.equal(res.status, 200);
  assert.match(res.headers['cache-control'], /max-age=60/);
  const s = res.body.stats;
  assert.ok(s.stores.active >= 1 && s.items.active >= 2);
  assert.ok(s.orders.total >= 4 && s.orders.byStatus.completed >= 2);
  assert.ok(s.users.buyers >= 2 && s.users.sellers >= 1);
  const mine = s.topStores.find((t) => t.id === seller.store.id);
  assert.ok(mine);
  assert.deepEqual(Object.keys(mine).sort(), ['city', 'iconUrl', 'id', 'level', 'name', 'score', 'stars']);
  const scores = s.topStores.map((t) => t.score);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a), 'sorted by score');

  assert.equal((await request(app).get(`${api}/stats`).query({ limit: 1 })).body.stats.topStores.length, 1);
  assert.equal((await request(app).get(`${api}/stats`).query({ limit: 0 })).body.error.code, 'INVALID_LIMIT');
  assert.equal((await request(app).get(`${api}/stats`).query({ city: 'Ciudad que no existe' })).body.stats.topStores.length, 0);
});

test('GET /stores returns the score and can be sorted by it with a cursor', async () => {
  const strong = (await storeWithOrders()).seller;
  const tag = `Orden${uniq()}`;
  const weak = await newSeller(D, { name: `${tag} sin nada`, city: 'Ciudad Orden' });
  const strongNamed = strong.store; // se busca por ciudad compartida
  assert.ok(strongNamed.id);

  const list = (q = {}) => request(app).get(`${api}/stores`).query({ sort: 'score', limit: 50, ...q });
  const all = (await list()).body.stores;
  for (const s of all) assert.ok(Number.isInteger(s.score) && typeof s.stars === 'number' && s.level);
  const scores = all.map((s) => s.score);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
  const iStrong = all.findIndex((s) => s.id === strong.store.id);
  const iWeak = all.findIndex((s) => s.id === weak.store.id);
  assert.ok(iStrong >= 0 && iWeak >= 0 && iStrong < iWeak, 'the store with orders ranks above the empty one');

  // Paginación por cursor sin repetir ni saltar tiendas.
  const seen = [];
  let cursor;
  for (let guard = 0; guard < 100; guard++) {
    const page = await list({ limit: 2, ...(cursor && { cursor }) });
    seen.push(...page.body.stores.map((s) => s.id));
    cursor = page.body.nextCursor;
    if (!cursor) break;
  }
  assert.deepEqual(seen, all.map((s) => s.id));

  // Orden por defecto: también trae el puntaje.
  const newest = (await request(app).get(`${api}/stores`).query({ limit: 3 })).body.stores;
  assert.ok(newest.every((s) => 'score' in s && 'level' in s));
  assert.equal((await list({ sort: 'rating' })).body.error.code, 'INVALID_SORT');
  assert.equal((await list({ cursor: 'abc' })).body.error.code, 'INVALID_CURSOR');
});
