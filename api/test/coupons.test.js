import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq, like } from 'drizzle-orm';
import request from 'supertest';
import app from '../src/app.js';
import { db, pool } from '../src/db/index.js';
import { user } from '../src/db/schema.js';
import { order } from '../src/db/orders.js';
import { cancelExpiredOrders } from '../src/services/orderService.js';
import { computeCouponDiscount } from '../src/services/couponEngine.js';
import { authed, newBuyer, newSeller, uniq } from './helpers.js';

const D = 'couponstest.local';
const api = '/api/v1';
const key = () => `key-${uniq()}-abcdefgh`;

after(async () => {
  await db.delete(user).where(like(user.email, `%@${D}`));
  await pool.end();
});

// Vendedor con dos ítems (10 000 y 5 000) y un comprador.
async function setup() {
  const seller = await newSeller(D);
  const mk = async (priceAmount, extra = {}) =>
    (await authed(request(app).post(`${api}/seller/items`), seller.token).send({ sku: `S-${uniq()}`, name: 'Galleta', priceAmount, status: 'active', initialStock: 50, ...extra })).body.item;
  const a = await mk(10_000);
  const b = await mk(5_000);
  const buyer = await newBuyer(D);
  return { seller, a, b, buyer };
}
const createCoupon = (seller, extra = {}) =>
  authed(request(app).post(`${api}/seller/coupons`), seller.token).send({ title: 'Cupón de prueba', type: 'percent', value: 1000, ...extra });
const assign = (seller, couponId, ...buyers) => authed(request(app).post(`${api}/seller/coupons/${couponId}/assign`), seller.token).send({ emails: buyers.map((b) => b.user.email) });
const add = (buyer, itemId, quantity) => authed(request(app).put(`${api}/cart/items/${itemId}`), buyer.token).send({ quantity });
const apply = (buyer, body) => authed(request(app).put(`${api}/cart/coupon`), buyer.token).send(body);
const getCart = async (buyer) => (await authed(request(app).get(`${api}/cart`), buyer.token)).body.cart;
const checkout = (buyer, k = key()) => authed(request(app).post(`${api}/orders`), buyer.token).set('Idempotency-Key', k);
const cancel = (buyer, id) => authed(request(app).post(`${api}/orders/${id}/cancel`), buyer.token);
const myCoupons = async (buyer, q = {}) => (await authed(request(app).get(`${api}/coupons`), buyer.token).query(q)).body;
const patch = (seller, id, body) => authed(request(app).patch(`${api}/seller/coupons/${id}`), seller.token).send(body);

test('seller creates coupons with validation, unique codes and per-store ownership', async () => {
  const { seller, a, b } = await setup();
  const res = await createCoupon(seller, { code: 'welcome10', description: '10 % en tu primera compra', minSubtotalAmount: 5000, maxDiscountAmount: 3000, maxRedemptions: 100, itemIds: [a.id, b.id] });
  assert.equal(res.status, 201);
  const c = res.body.coupon;
  assert.equal(c.code, 'WELCOME10');
  assert.deepEqual([c.type, c.value, c.maxDiscountAmount, c.minSubtotalAmount, c.perUserLimit, c.audience, c.status], ['percent', 1000, 3000, 5000, 1, 'assigned', 'active']);
  assert.deepEqual(c.itemIds.sort(), [a.id, b.id].sort());
  assert.deepEqual([c.redeemed, c.walletUsers], [0, 0]);

  assert.equal((await createCoupon(seller, { code: 'WELCOME10' })).body.error.code, 'COUPON_CODE_EXISTS');
  const bad = async (extra, code) => assert.equal((await createCoupon(seller, extra)).body.error.code, code, JSON.stringify(extra));
  await bad({ type: 'other' }, 'INVALID_TYPE');
  await bad({ value: 9001 }, 'INVALID_VALUE');
  await bad({ value: 0 }, 'INVALID_VALUE');
  await bad({ type: 'fixed', value: 500, maxDiscountAmount: 100 }, 'INVALID_MAX_DISCOUNT');
  await bad({ title: 'x' }, 'INVALID_TITLE');
  await bad({ code: 'a' }, 'INVALID_CODE');
  await bad({ audience: 'everyone' }, 'INVALID_AUDIENCE');
  await bad({ perUserLimit: 0 }, 'INVALID_PER_USER_LIMIT');
  await bad({ startsAt: '2026-01-02T00:00:00Z', endsAt: '2026-01-01T00:00:00Z' }, 'INVALID_DATES');
  await bad({ itemIds: [999999] }, 'INVALID_ITEMS');
  const other = await newSeller(D);
  const foreign = (await authed(request(app).post(`${api}/seller/items`), other.token).send({ sku: 'X-1', name: 'Ajeno', priceAmount: 100, status: 'active', initialStock: 1 })).body.item;
  await bad({ itemIds: [foreign.id] }, 'INVALID_ITEMS');

  // La misma clave en otra tienda sí se puede, y en esta misma tras borrar el cupón.
  assert.equal((await createCoupon(other, { code: 'welcome10' })).status, 201);
  const get = (s, id) => authed(request(app).get(`${api}/seller/coupons/${id}`), s.token);
  assert.equal((await get(seller, c.id)).status, 200);
  assert.equal((await get(other, c.id)).body.error.code, 'FORBIDDEN');
  assert.equal((await get(seller, 999999)).status, 404);
  const buyer = await newBuyer(D);
  assert.equal((await authed(request(app).get(`${api}/seller/coupons`), buyer.token)).status, 403);
  assert.equal((await request(app).get(`${api}/seller/coupons`)).status, 401);

  const list = await authed(request(app).get(`${api}/seller/coupons`), seller.token);
  assert.equal(list.body.coupons.length, 1);
  assert.equal((await authed(request(app).get(`${api}/seller/coupons`).query({ status: 'paused' }), seller.token)).body.coupons.length, 0);
  assert.equal((await authed(request(app).get(`${api}/seller/coupons`).query({ status: 'nope' }), seller.token)).body.error.code, 'INVALID_STATUS');

  assert.equal((await patch(seller, c.id, {})).body.error.code, 'EMPTY_UPDATE');
  const edited = await patch(seller, c.id, { title: 'Bienvenida', value: 1500, itemIds: [a.id] });
  assert.deepEqual([edited.body.coupon.title, edited.body.coupon.value, edited.body.coupon.itemIds], ['Bienvenida', 1500, [a.id]]);
  assert.equal((await patch(seller, c.id, { status: 'paused' })).body.coupon.status, 'paused');
  assert.equal((await patch(seller, c.id, { status: 'otro' })).body.error.code, 'INVALID_STATUS');
  assert.equal((await authed(request(app).delete(`${api}/seller/coupons/${c.id}`), seller.token)).status, 204);
  assert.equal((await get(seller, c.id)).status, 404);
  assert.equal((await createCoupon(seller, { code: 'WELCOME10' })).status, 201, 'the code is free again');
});

test('wallet: assign by email, claim public coupons and list with states', async () => {
  const { seller, buyer } = await setup();
  const other = await newBuyer(D);
  const assigned = (await createCoupon(seller, { title: 'Solo para ti' })).body.coupon;
  const pub = (await createCoupon(seller, { title: 'Para todos', audience: 'public', code: 'TODOS' })).body.coupon;

  const res = await authed(request(app).post(`${api}/seller/coupons/${assigned.id}/assign`), seller.token).send({ emails: [buyer.user.email.toUpperCase(), 'nadie@nada.test', seller.user.email, buyer.user.email] });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { assigned: [buyer.user.email], alreadyHad: [], notFound: ['nadie@nada.test', seller.user.email] });
  assert.deepEqual((await assign(seller, assigned.id, buyer)).body, { assigned: [], alreadyHad: [buyer.user.email], notFound: [] });
  assert.equal((await authed(request(app).post(`${api}/seller/coupons/${assigned.id}/assign`), seller.token).send({ emails: [] })).body.error.code, 'INVALID_EMAILS');
  assert.equal((await authed(request(app).get(`${api}/seller/coupons/${assigned.id}`), seller.token)).body.coupon.walletUsers, 1);

  const mine = await myCoupons(buyer);
  const byTitle = (list, t) => list.coupons.find((c) => c.title === t);
  assert.equal(mine.coupons.length, 2);
  assert.deepEqual([byTitle(mine, 'Solo para ti').inWallet, byTitle(mine, 'Solo para ti').source, byTitle(mine, 'Solo para ti').state], [true, 'assigned', 'available']);
  assert.deepEqual([byTitle(mine, 'Para todos').inWallet, byTitle(mine, 'Para todos').source], [false, null]);
  assert.equal(byTitle(mine, 'Solo para ti').store.id, seller.store.id);
  const strangerView = await myCoupons(other);
  assert.deepEqual(strangerView.coupons.map((c) => c.title), ['Para todos'], 'assigned coupons are private');

  assert.equal((await authed(request(app).post(`${api}/coupons/${assigned.id}/claim`), other.token)).status, 404);
  const claimed = await authed(request(app).post(`${api}/coupons/${pub.id}/claim`), other.token);
  assert.equal(claimed.status, 201);
  assert.deepEqual([claimed.body.coupon.inWallet, claimed.body.coupon.source], [true, 'claimed']);
  assert.equal((await authed(request(app).post(`${api}/coupons/${pub.id}/claim`), other.token)).status, 200);
  assert.equal((await authed(request(app).post(`${api}/coupons/999999/claim`), other.token)).status, 404);

  assert.equal((await myCoupons(buyer, { storeId: seller.store.id })).coupons.length, 2);
  assert.equal((await myCoupons(buyer, { storeId: 999999 })).coupons.length, 0);
  assert.equal((await myCoupons(buyer, { status: 'used' })).coupons.length, 0);
  assert.equal((await myCoupons(buyer, { status: 'zzz' })).error.code, 'INVALID_STATUS');
  const p1 = await myCoupons(buyer, { limit: 1 });
  assert.equal(p1.coupons.length, 1);
  const p2 = await myCoupons(buyer, { limit: 1, cursor: p1.nextCursor });
  assert.deepEqual([p1.coupons[0].id, p2.coupons[0].id].sort(), [assigned.id, pub.id].sort());
  assert.equal(p2.nextCursor, null);

  // Solo compradores usan la cartera.
  assert.equal((await authed(request(app).get(`${api}/coupons`), seller.token)).status, 403);
  assert.equal((await request(app).get(`${api}/coupons`)).status, 401);
});

test('applying to the cart: percent, cap, minimum, scope, item discounts and one coupon at most', async () => {
  const { seller, a, b, buyer } = await setup();
  const cp = (await createCoupon(seller, { title: 'Diez', value: 1000, maxDiscountAmount: 3000, minSubtotalAmount: 20_000 })).body.coupon;
  await assign(seller, cp.id, buyer);

  assert.equal((await apply(buyer, { couponId: cp.id })).body.error.code, 'CART_EMPTY');
  await add(buyer, a.id, 1); // 10 000: no llega al mínimo
  const short = await apply(buyer, { couponId: cp.id });
  assert.equal(short.status, 409);
  assert.equal(short.body.error.code, 'COUPON_MIN_NOT_MET');
  assert.equal((await getCart(buyer)).coupon, null, 'a refused coupon is not kept');

  await add(buyer, a.id, 3); // 30 000 → 10 % = 3 000, justo en el tope
  let cart = (await apply(buyer, { couponId: cp.id })).body.cart;
  assert.deepEqual([cart.subtotalAmount, cart.discountAmount, cart.couponDiscountAmount, cart.totalAmount, cart.couponError], [30_000, 0, 3000, 27_000, null]);
  assert.deepEqual([cart.coupon.id, cart.coupon.title, cart.coupon.type, cart.coupon.value], [cp.id, 'Diez', 'percent', 1000]);

  await add(buyer, a.id, 5); // 50 000 → 10 % = 5 000, limitado a 3 000
  cart = await getCart(buyer);
  assert.deepEqual([cart.couponDiscountAmount, cart.totalAmount], [3000, 47_000]);

  // El cupón se aplica sobre el precio ya rebajado por el descuento de ítem.
  await authed(request(app).post(`${api}/seller/items/${a.id}/discounts`), seller.token).send({ type: 'percent', value: 1000 });
  await add(buyer, a.id, 3); // 3 × 9 000 = 27 000 → 10 % = 2 700
  cart = await getCart(buyer);
  assert.deepEqual([cart.subtotalAmount, cart.discountAmount, cart.couponDiscountAmount, cart.totalAmount], [30_000, 3000, 2700, 24_300]);

  // Si el carrito baja del mínimo, el cupón sigue puesto pero avisa y no descuenta.
  await add(buyer, a.id, 1);
  cart = await getCart(buyer);
  assert.deepEqual([cart.couponError, cart.couponDiscountAmount, cart.totalAmount, cart.coupon.id], ['COUPON_MIN_NOT_MET', 0, 9000, cp.id]);

  // Solo un cupón: aplicar otro reemplaza al anterior; quitarlo lo deja sin cupón.
  const second = (await createCoupon(seller, { title: 'Fijo', type: 'fixed', value: 500 })).body.coupon;
  await assign(seller, second.id, buyer);
  cart = (await apply(buyer, { couponId: second.id })).body.cart;
  assert.deepEqual([cart.coupon.id, cart.couponDiscountAmount, cart.totalAmount], [second.id, 500, 8500]);
  cart = (await authed(request(app).delete(`${api}/cart/coupon`), buyer.token)).body.cart;
  assert.deepEqual([cart.coupon, cart.couponDiscountAmount, cart.totalAmount], [null, 0, 9000]);

  // Alcance por productos: solo cuentan los ítems del cupón.
  const scoped = (await createCoupon(seller, { title: 'Solo b', itemIds: [b.id] })).body.coupon;
  await assign(seller, scoped.id, buyer);
  assert.equal((await apply(buyer, { couponId: scoped.id })).body.error.code, 'COUPON_NOT_APPLICABLE');
  await add(buyer, b.id, 2); // b: 10 000 → 10 % = 1 000
  cart = (await apply(buyer, { couponId: scoped.id })).body.cart;
  assert.equal(cart.couponDiscountAmount, 1000);

  // Un descuento fijo mayor que el pedido nunca lo deja en 0.
  const huge = (await createCoupon(seller, { title: 'Enorme', type: 'fixed', value: 5_000_000 })).body.coupon;
  await assign(seller, huge.id, buyer);
  cart = (await apply(buyer, { couponId: huge.id })).body.cart;
  assert.deepEqual([cart.couponDiscountAmount, cart.totalAmount], [cart.subtotalAmount - cart.discountAmount - 1, 1]);

  assert.equal((await apply(buyer, {})).body.error.code, 'COUPON_REQUIRED');
  assert.equal((await apply(buyer, { couponId: 'x' })).body.error.code, 'INVALID_COUPON');
  assert.equal((await authed(request(app).put(`${api}/cart/coupon`), seller.token).send({ couponId: cp.id })).status, 403);

  // Vaciar el carrito suelta el cupón.
  await authed(request(app).delete(`${api}/cart`), buyer.token);
  assert.equal((await getCart(buyer)).coupon, null);
});

test('who can apply what: wallet, public codes, other stores, paused and expired coupons', async () => {
  const { seller, a, buyer } = await setup();
  const stranger = await newBuyer(D);
  await add(buyer, a.id, 2);

  const mine = (await createCoupon(seller, { title: 'Mío' })).body.coupon;
  await assign(seller, mine.id, buyer);
  assert.equal((await apply(stranger, { couponId: mine.id })).status, 409, 'cart of another store is empty or different');
  await add(stranger, a.id, 1);
  assert.equal((await apply(stranger, { couponId: mine.id })).body.error.code, 'COUPON_NOT_FOUND', 'assigned coupons of others are not revealed');

  const pub = (await createCoupon(seller, { title: 'Público', audience: 'public', code: 'abierto' })).body.coupon;
  assert.equal((await apply(buyer, { couponId: pub.id })).body.error.code, 'COUPON_NOT_ELIGIBLE', 'save it first');
  const byCode = await apply(buyer, { code: 'ABIERTO' });
  assert.equal(byCode.status, 200, 'a public coupon is saved when its code is typed');
  assert.equal((await myCoupons(buyer)).coupons.find((c) => c.id === pub.id).source, 'claimed');
  assert.equal((await apply(buyer, { code: 'no-existe' })).body.error.code, 'COUPON_NOT_FOUND');

  // De otra tienda.
  const other = await newSeller(D);
  const foreign = (await authed(request(app).post(`${api}/seller/coupons`), other.token).send({ title: 'Ajeno', type: 'percent', value: 500, audience: 'public' })).body.coupon;
  assert.equal((await apply(buyer, { couponId: foreign.id })).body.error.code, 'COUPON_WRONG_STORE');

  // Pausado y vencido: avisa en el carrito.
  await patch(seller, pub.id, { status: 'paused' });
  assert.equal((await getCart(buyer)).couponError, 'COUPON_PAUSED');
  assert.equal((await apply(buyer, { couponId: pub.id })).body.error.code, 'COUPON_PAUSED');
  await patch(seller, pub.id, { status: 'active' });
  assert.equal((await getCart(buyer)).couponError, null);
  const past = new Date(Date.now() - 2 * 86_400_000).toISOString();
  const expired = (await createCoupon(seller, { title: 'Viejo', startsAt: past, endsAt: new Date(Date.now() - 86_400_000).toISOString() })).body.coupon;
  await assign(seller, expired.id, buyer);
  assert.equal((await apply(buyer, { couponId: expired.id })).body.error.code, 'COUPON_EXPIRED');
  const future = (await createCoupon(seller, { title: 'Futuro', startsAt: new Date(Date.now() + 86_400_000).toISOString() })).body.coupon;
  await assign(seller, future.id, buyer);
  assert.equal((await apply(buyer, { couponId: future.id })).body.error.code, 'COUPON_NOT_STARTED');
  const states = Object.fromEntries((await myCoupons(buyer)).coupons.map((c) => [c.title, c.state]));
  assert.deepEqual([states.Viejo, states.Futuro, states.Mío], ['expired', 'upcoming', 'available']);
});

test('checkout freezes the coupon in the order, is idempotent and the payment charges the discounted total', async () => {
  const { seller, a, buyer } = await setup();
  const cp = (await createCoupon(seller, { title: 'Checkout', value: 1000, code: 'PAGO10' })).body.coupon;
  await assign(seller, cp.id, buyer);
  await add(buyer, a.id, 3); // 30 000
  await apply(buyer, { couponId: cp.id });

  const k = key();
  const res = await checkout(buyer, k);
  assert.equal(res.status, 201);
  const o = res.body.order;
  assert.deepEqual([o.subtotalAmount, o.discountAmount, o.couponDiscountAmount, o.totalAmount, o.couponCode, o.couponId], [30_000, 0, 3000, 27_000, 'PAGO10', cp.id]);
  assert.equal(o.commissionAmount, Math.round(27_000 * o.commissionRate), 'the commission is on the discounted total');

  const again = await checkout(buyer, k);
  assert.equal(again.status, 200);
  assert.equal(again.body.order.id, o.id);
  const seen = await authed(request(app).get(`${api}/seller/coupons/${cp.id}/redemptions`), seller.token);
  assert.equal(seen.body.redemptions.length, 1, 'a repeated request does not use the coupon twice');
  assert.deepEqual([seen.body.redemptions[0].orderNumber, seen.body.redemptions[0].discountAmount, seen.body.redemptions[0].status], [o.number, 3000, 'reserved']);
  assert.equal((await authed(request(app).get(`${api}/seller/coupons/${cp.id}`), seller.token)).body.coupon.redeemed, 1);

  const detail = (await authed(request(app).get(`${api}/orders/${o.id}`), buyer.token)).body.order;
  assert.equal(detail.couponDiscountAmount, 3000);
  const pay = await authed(request(app).post(`${api}/orders/${o.id}/pay`), buyer.token).set('Idempotency-Key', key());
  assert.equal(pay.body.payment.amount, 27_000);

  // El cupón del carrito se consumió con el carrito; el siguiente carrito empieza sin cupón.
  assert.equal((await getCart(buyer)).coupon, null);
  const sellerOrder = (await authed(request(app).get(`${api}/seller/orders/${o.id}`), seller.token)).body.order;
  assert.equal(sellerOrder.couponCode, 'PAGO10');
});

test('per-user limit: the use is reserved at checkout and given back when the order is cancelled', async () => {
  const { seller, a, buyer } = await setup();
  const cp = (await createCoupon(seller, { title: 'Una vez' })).body.coupon;
  await assign(seller, cp.id, buyer);
  await add(buyer, a.id, 2);
  await apply(buyer, { couponId: cp.id });
  const first = (await checkout(buyer)).body.order;
  assert.equal((await myCoupons(buyer)).coupons[0].state, 'used');

  await add(buyer, a.id, 2);
  assert.equal((await apply(buyer, { couponId: cp.id })).body.error.code, 'COUPON_USER_LIMIT');

  assert.equal((await cancel(buyer, first.id)).status, 200);
  assert.equal((await myCoupons(buyer)).coupons[0].state, 'available');
  const redemptions = (await authed(request(app).get(`${api}/seller/coupons/${cp.id}/redemptions`), seller.token)).body.redemptions;
  assert.deepEqual([redemptions[0].status, redemptions[0].releasedAt !== null], ['released', true]);
  assert.equal((await apply(buyer, { couponId: cp.id })).status, 200);
  assert.equal((await checkout(buyer)).status, 201);
  assert.equal((await authed(request(app).get(`${api}/seller/coupons/${cp.id}`), seller.token)).body.coupon.redeemed, 1);

  // perUserLimit 2: dos pedidos, el tercero no.
  const two = (await createCoupon(seller, { title: 'Dos veces', perUserLimit: 2 })).body.coupon;
  await assign(seller, two.id, buyer);
  for (let i = 0; i < 2; i++) {
    await add(buyer, a.id, 1);
    await apply(buyer, { couponId: two.id });
    assert.equal((await checkout(buyer)).status, 201);
  }
  await add(buyer, a.id, 1);
  assert.equal((await apply(buyer, { couponId: two.id })).body.error.code, 'COUPON_USER_LIMIT');
});

test('total limit: two buyers racing for the last use, exactly one gets it', async () => {
  const { seller, a } = await setup();
  const cp = (await createCoupon(seller, { title: 'Último', audience: 'public', code: 'ULTIMO', maxRedemptions: 1 })).body.coupon;
  const [x, y] = [await newBuyer(D), await newBuyer(D)];
  for (const buyer of [x, y]) {
    await add(buyer, a.id, 2);
    assert.equal((await apply(buyer, { code: 'ULTIMO' })).status, 200);
  }
  const results = await Promise.all([checkout(x), checkout(y)]);
  const statuses = results.map((r) => r.status).sort();
  assert.deepEqual(statuses, [201, 409]);
  assert.equal(results.find((r) => r.status === 409).body.error.code, 'COUPON_EXHAUSTED');
  assert.equal((await authed(request(app).get(`${api}/seller/coupons/${cp.id}`), seller.token)).body.coupon.redeemed, 1);

  // El perdedor no dejó pedido ni stock reservado.
  const loser = results.findIndex((r) => r.status === 409) === 0 ? x : y;
  assert.equal((await authed(request(app).get(`${api}/orders`), loser.token)).body.orders.length, 0);
  assert.equal((await request(app).get(`${api}/items/${a.id}`)).body.item.available, 48);
  // Al quitar el cupón, el perdedor sí puede comprar.
  await authed(request(app).delete(`${api}/cart/coupon`), loser.token);
  assert.equal((await checkout(loser)).status, 201);
});

test('checkout validates again: a coupon paused after applying it blocks the order and keeps stock free', async () => {
  const { seller, a, buyer } = await setup();
  const cp = (await createCoupon(seller, { title: 'Pausable' })).body.coupon;
  await assign(seller, cp.id, buyer);
  await add(buyer, a.id, 2);
  await apply(buyer, { couponId: cp.id });
  await patch(seller, cp.id, { status: 'paused' });
  const res = await checkout(buyer);
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'COUPON_PAUSED');
  assert.equal((await request(app).get(`${api}/items/${a.id}`)).body.item.available, 50);
  assert.equal((await getCart(buyer)).lines.length, 1, 'the cart is untouched');
  await authed(request(app).delete(`${api}/cart/coupon`), buyer.token);
  assert.equal((await checkout(buyer)).status, 201, 'without the coupon the order goes through at full price');
});

test('an order that expires unpaid gives the coupon back', async () => {
  const { seller, a, buyer } = await setup();
  const cp = (await createCoupon(seller, { title: 'Vence' })).body.coupon;
  await assign(seller, cp.id, buyer);
  await add(buyer, a.id, 2);
  await apply(buyer, { couponId: cp.id });
  const o = (await checkout(buyer)).body.order;
  await db.update(order).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(order.id, o.id));
  assert.ok((await cancelExpiredOrders()) >= 1);
  assert.equal((await myCoupons(buyer)).coupons[0].state, 'available');
  assert.equal((await authed(request(app).get(`${api}/seller/coupons/${cp.id}`), seller.token)).body.coupon.redeemed, 0);
});

test('a coupon that was used keeps its terms; it cannot be deleted while an order waits for payment', async () => {
  const { seller, a, buyer } = await setup();
  const cp = (await createCoupon(seller, { title: 'Usado', maxRedemptions: 5, code: 'USADO' })).body.coupon;
  await assign(seller, cp.id, buyer);
  await add(buyer, a.id, 2);
  await apply(buyer, { couponId: cp.id });
  const o = (await checkout(buyer)).body.order;

  assert.equal((await patch(seller, cp.id, { value: 2000 })).body.error.code, 'COUPON_IN_USE');
  assert.equal((await patch(seller, cp.id, { title: 'Usado (renombrado)', maxRedemptions: 10 })).status, 200);
  assert.equal((await patch(seller, cp.id, { maxRedemptions: 0 })).body.error.code, 'INVALID_MAX_REDEMPTIONS');
  assert.equal((await authed(request(app).delete(`${api}/seller/coupons/${cp.id}`), seller.token)).body.error.code, 'COUPON_IN_USE');

  // El pedido conserva lo que se aplicó aunque el cupón cambie.
  assert.equal((await authed(request(app).get(`${api}/orders/${o.id}`), buyer.token)).body.order.couponCode, 'USADO');
  await cancel(buyer, o.id);
  assert.equal((await authed(request(app).delete(`${api}/seller/coupons/${cp.id}`), seller.token)).status, 204);
  assert.equal((await authed(request(app).get(`${api}/orders/${o.id}`), buyer.token)).body.order.couponDiscountAmount, 2000);
});

test('discount math: floor, cap, applicable base and never a free order', () => {
  const lines = [{ itemId: 1, lineAmount: 10_000 }, { itemId: 2, lineAmount: 5_000 }];
  const percent = (value, extra = {}) => ({ type: 'percent', value, maxDiscountAmount: null, ...extra });
  assert.equal(computeCouponDiscount(percent(1000), new Set(), lines, 15_000), 1500);
  assert.equal(computeCouponDiscount(percent(333), new Set(), lines, 15_000), 499, 'floors to the smaller unit');
  assert.equal(computeCouponDiscount(percent(1000, { maxDiscountAmount: 1000 }), new Set(), lines, 15_000), 1000, 'cap');
  assert.equal(computeCouponDiscount(percent(1000), new Set([2]), lines, 15_000), 500, 'only the applicable items');
  assert.equal(computeCouponDiscount(percent(1000), new Set([99]), lines, 15_000), 0, 'nothing applicable');
  assert.equal(computeCouponDiscount({ type: 'fixed', value: 4000 }, new Set([2]), lines, 15_000), 4000);
  assert.equal(computeCouponDiscount({ type: 'fixed', value: 9000 }, new Set([2]), lines, 15_000), 5000, 'never above the applicable base');
  assert.equal(computeCouponDiscount({ type: 'fixed', value: 90_000 }, new Set(), lines, 15_000), 14_999, 'the order is never free');
});
