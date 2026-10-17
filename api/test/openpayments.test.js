// Esta suite corre con el proveedor Open Payments y un cliente simulado: no usa la red de Interledger.
process.env.PAYMENT_PROVIDER = 'openpayments';
process.env.NODE_ENV = 'test';

import { test, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { eq, like } from 'drizzle-orm';
import request from 'supertest';

const { default: app } = await import('../src/app.js');
const { db, pool } = await import('../src/db/index.js');
const { user } = await import('../src/db/schema.js');
const { order } = await import('../src/db/orders.js');
const { payment } = await import('../src/db/payments.js');
const { paymentSession } = await import('../src/db/wallets.js');
const { setClientFactory, pollOptions, interactionHash } = await import('../src/payments/openpayments.js');
const { authed, newBuyer, newSeller, uniq } = await import('./helpers.js');

const D = 'optest.local';
const api = '/api/v1';
const key = () => `key-${uniq()}-abcdefgh`;
pollOptions.intervalMs = 0;

after(async () => {
  setClientFactory(null);
  await db.delete(user).where(like(user.email, `%@${D}`));
  await pool.end();
});

// Cliente simulado de Open Payments. `sim` controla qué responde la red.
let sim;
beforeEach(() => {
  sim = { fee: 100n, assetCode: 'USD', assetScale: 2, quoteExpiresAt: null, sentRatio: 1, failed: false, calls: [] };
  setClientFactory(async () => ({
    walletAddress: {
      get: async ({ url }) => {
        if (url.includes('missing')) throw new Error('404');
        return { id: url, assetCode: sim.assetCode, assetScale: sim.assetScale, authServer: `${url}/auth`, resourceServer: `${url}/rs` };
      },
    },
    grant: {
      request: async (_server, body) => {
        const type = body.access_token.access[0].type;
        if (type !== 'outgoing-payment') return { access_token: { value: `tok-${type}` } };
        sim.nonce = body.interact.finish.nonce;
        sim.debit = body.access_token.access[0].limits.debitAmount;
        return {
          interact: { redirect: 'https://wallet.test/consent?clientUri=x&y=1', finish: 'server-nonce' },
          continue: { uri: 'https://wallet.test/continue', access_token: { value: 'cont-secret' } },
        };
      },
      continue: async (_c, { interact_ref }) => {
        sim.calls.push('continue');
        sim.interactRef = interact_ref;
        return { access_token: { value: 'tok-out' } };
      },
    },
    incomingPayment: {
      create: async (_s, body) => ({ id: `https://seller.test/incoming/${uniq()}`, ...body }),
      get: async () => ({ receivedAmount: { value: sim.received ?? sim.receive.value } }),
    },
    quote: {
      create: async (_s, body) => {
        sim.receive = { value: sim.incomingValue ?? '0', assetCode: sim.assetCode, assetScale: sim.assetScale };
        return {
          id: 'https://buyer.test/quote/1',
          expiresAt: sim.quoteExpiresAt ?? new Date(Date.now() + 300_000).toISOString(),
          receiveAmount: sim.receive,
          debitAmount: { value: String(BigInt(sim.receive.value) + sim.fee), assetCode: sim.assetCode, assetScale: sim.assetScale },
          receiver: body.receiver,
        };
      },
    },
    outgoingPayment: {
      create: async () => {
        sim.calls.push('outgoing');
        return { id: `https://buyer.test/out/${uniq()}`, failed: sim.failed, debitAmount: sim.debit, sentAmount: { value: sim.failed ? '0' : sim.debit.value } };
      },
      get: async () => ({ id: 'https://buyer.test/out/1', failed: sim.failed, debitAmount: sim.debit, sentAmount: sim.debit }),
    },
  }));
});

const link = (who, address, extra = {}) => authed(request(app).post(`${api}/me/wallets`), who.token).send({ address, ...extra });
const wallets = async (who) => (await authed(request(app).get(`${api}/me/wallets`), who.token)).body.wallets;

// Pedido de 2 unidades de 1000 (total 2000 = 20.00 USD). El vendedor y el comprador vinculan wallet salvo que se indique.
async function setup({ buyerWallet = true, sellerWallet = true } = {}) {
  const seller = await newSeller(D);
  const it = (
    await authed(request(app).post(`${api}/seller/items`), seller.token).send({ sku: `S-${uniq()}`, name: 'Galleta', priceAmount: 1000, status: 'active', initialStock: 5 })
  ).body.item;
  const buyer = await newBuyer(D);
  if (sellerWallet) assert.equal((await link(seller, `https://seller.test/${uniq()}`)).status, 201);
  if (buyerWallet) assert.equal((await link(buyer, `https://buyer.test/${uniq()}`)).status, 201);
  await authed(request(app).put(`${api}/cart/items/${it.id}`), buyer.token).send({ quantity: 2 });
  const o = (await authed(request(app).post(`${api}/orders`), buyer.token).set('Idempotency-Key', key())).body.order;
  sim.incomingValue = '2000';
  return { seller, buyer, it, o };
}
const pay = (buyer, orderId, k = key()) => authed(request(app).post(`${api}/orders/${orderId}/pay`), buyer.token).set('Idempotency-Key', k);
const sessionOf = async (orderId) => {
  const [p] = await db.select().from(payment).where(eq(payment.orderId, orderId));
  const [s] = await db.select().from(paymentSession).where(eq(paymentSession.paymentId, p.id));
  return { p, s };
};
const back = (orderId, s, ref = 'ref-1', hash) =>
  request(app)
    .get(`${api}/payments/openpayments/return/${orderId}`)
    .query({ interact_ref: ref, hash: hash ?? interactionHash(s.nonce, 'server-nonce', ref, s.buyerAuthServer) });
const orderStatus = async (id) => (await db.select().from(order).where(eq(order.id, id)))[0].status;

test('wallets: varias por usuario, con nombre propio y una principal', async () => {
  const buyer = await newBuyer(D);
  assert.deepEqual(await wallets(buyer), []);
  assert.equal((await link(buyer, 'not a url')).body.error.code, 'INVALID_WALLET_ADDRESS');
  assert.equal((await link(buyer, 'http://insecure.test/x')).status, 400);
  assert.equal((await link(buyer, 'https://buyer.test/missing')).body.error.code, 'WALLET_NOT_FOUND');
  assert.equal((await link(buyer, 'https://ilp.test/ana', { name: 'x'.repeat(61) })).body.error.code, 'INVALID_WALLET_NAME');

  const first = await link(buyer, '$ilp.test/ana/', { name: '  Mi cuenta EUR ' });
  assert.equal(first.status, 201);
  assert.deepEqual(
    [first.body.wallet.address, first.body.wallet.name, first.body.wallet.assetCode, first.body.wallet.assetScale, first.body.wallet.isPrimary],
    ['https://ilp.test/ana', 'Mi cuenta EUR', 'USD', 2, true], // la primera queda como principal
  );
  const second = await link(buyer, 'https://ilp.test/ahorros', { name: 'Ahorros' });
  assert.equal(second.body.wallet.isPrimary, false);
  assert.equal((await link(buyer, 'https://ilp.test/ana')).body.error.code, 'WALLET_ALREADY_LINKED');
  assert.deepEqual((await wallets(buyer)).map((w) => w.name), ['Mi cuenta EUR', 'Ahorros']);

  const patch = (id, body, who = buyer) => authed(request(app).patch(`${api}/me/wallets/${id}`), who.token).send(body);
  assert.equal((await patch(second.body.wallet.id, { name: 'Ahorros COP' })).body.wallet.name, 'Ahorros COP');
  assert.equal((await patch(second.body.wallet.id, {})).body.error.code, 'EMPTY_UPDATE');
  assert.equal((await patch(second.body.wallet.id, { primary: false })).body.error.code, 'INVALID_PRIMARY');
  const swapped = await patch(second.body.wallet.id, { primary: true });
  assert.equal(swapped.body.wallet.isPrimary, true);
  assert.deepEqual((await wallets(buyer)).map((w) => w.isPrimary), [false, true]); // solo una principal
  assert.equal((await patch(second.body.wallet.id, { name: null })).body.wallet.name, null);

  const other = await newBuyer(D);
  assert.equal((await patch(first.body.wallet.id, { name: 'robada' }, other)).status, 404); // ajena
  const del = (id, who = buyer) => authed(request(app).delete(`${api}/me/wallets/${id}`), who.token);
  assert.equal((await del(first.body.wallet.id, other)).status, 404);
  assert.equal((await del(second.body.wallet.id)).status, 204); // borrar la principal asciende a la otra
  assert.deepEqual((await wallets(buyer)).map((w) => [w.name, w.isPrimary]), [['Mi cuenta EUR', true]]);
  assert.equal((await del(second.body.wallet.id)).status, 404);
  assert.equal((await request(app).get(`${api}/me/wallets`)).status, 401);
});

test('pagar sin wallet del comprador o de la tienda no se puede', async () => {
  const a = await setup({ buyerWallet: false });
  assert.equal((await pay(a.buyer, a.o.id)).body.error.code, 'BUYER_WALLET_REQUIRED');
  const b = await setup({ sellerWallet: false });
  assert.equal((await pay(b.buyer, b.o.id)).body.error.code, 'SELLER_WALLET_REQUIRED');
  const c = await setup();
  sim.assetCode = 'COP';
  await link(c.seller, `https://seller.test/${uniq()}`, { primary: true }); // ahora la wallet principal de la tienda cobra en COP
  assert.equal((await pay(c.buyer, c.o.id)).body.error.code, 'CURRENCY_MISMATCH');
});

test('checkout: devuelve cotización, comisión y redirección, y es idempotente', async () => {
  const { buyer, o } = await setup();
  const k = key();
  const first = await pay(buyer, o.id, k);
  assert.equal(first.status, 201);
  assert.equal(first.body.payment.provider, 'openpayments');
  assert.equal(first.body.payment.status, 'pending');
  assert.equal(first.body.checkout.receive.value, '2000');
  assert.equal(first.body.checkout.debit.value, '2100');
  assert.equal(first.body.checkout.fee.value, '100');
  assert.match(first.body.checkout.redirectUrl, /clientUri=x&y=1/); // la URL llega entera
  assert.equal(JSON.stringify(first.body).includes('cont-secret'), false); // el token de continuación no sale

  const again = await pay(buyer, o.id, k);
  assert.equal(again.status, 200);
  assert.equal(again.body.payment.id, first.body.payment.id);
  assert.equal(again.body.checkout.redirectUrl, first.body.checkout.redirectUrl);
  const other = await pay(buyer, o.id);
  assert.equal(other.body.payment.id, first.body.payment.id);
  assert.equal((await pay(await newBuyer(D), o.id)).status, 404);
});

test('vuelta: con hash válido y monto completo el pedido queda pagado; repetir no cobra dos veces', async () => {
  const { buyer, o } = await setup();
  await pay(buyer, o.id);
  const { s } = await sessionOf(o.id);
  const ok = await back(o.id, s);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.status, 'paid');
  assert.equal(await orderStatus(o.id), 'paid');
  assert.deepEqual(sim.calls, ['continue', 'outgoing']);
  const [p] = await db.select().from(payment).where(eq(payment.orderId, o.id));
  assert.equal(p.status, 'captured');
  assert.equal((await back(o.id, s)).body.status, 'paid'); // callback repetido
  assert.deepEqual(sim.calls, ['continue', 'outgoing']);
  assert.equal((await authed(request(app).get(`${api}/orders/${o.id}/payments`), buyer.token)).body.payments[0].status, 'captured');
});

test('vuelta: hash inválido no continúa el grant; consentimiento negado deja el pedido sin pagar', async () => {
  const { buyer, o } = await setup();
  await pay(buyer, o.id);
  const { s } = await sessionOf(o.id);
  const bad = await back(o.id, s, 'ref-1', 'AAAA');
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error.code, 'INVALID_INTERACTION_HASH');
  assert.deepEqual(sim.calls, []);
  const denied = await request(app).get(`${api}/payments/openpayments/return/${o.id}`).query({ result: 'grant_rejected' });
  assert.equal(denied.body.status, 'denied');
  assert.equal(await orderStatus(o.id), 'pending_payment');
  assert.equal((await sessionOf(o.id)).s.status, 'pending'); // sigue vigente: se puede aprobar después
  assert.equal((await request(app).get(`${api}/payments/openpayments/return/999999999`)).status, 404);
});

test('vuelta: si llegó menos de lo cotizado o el pago falló, el pedido no se marca pagado', async () => {
  const a = await setup();
  await pay(a.buyer, a.o.id);
  sim.received = '1999';
  const short = await back(a.o.id, (await sessionOf(a.o.id)).s);
  assert.equal(short.body.status, 'failed');
  assert.equal(await orderStatus(a.o.id), 'pending_payment');

  const b = await setup();
  await pay(b.buyer, b.o.id);
  sim.failed = true;
  sim.received = '0';
  assert.equal((await back(b.o.id, (await sessionOf(b.o.id)).s)).body.status, 'failed');
  assert.equal(await orderStatus(b.o.id), 'pending_payment');
  // el comprador puede reintentar: se crea otro cobro con una cotización nueva
  sim.failed = false;
  sim.received = undefined;
  const retry = await pay(b.buyer, b.o.id);
  assert.equal(retry.status, 201);
  assert.equal(retry.body.checkout.receive.value, '2000');
});

test('cotización vencida: la vuelta se rechaza y pagar de nuevo pide una cotización nueva', async () => {
  const { buyer, o } = await setup();
  sim.quoteExpiresAt = new Date(Date.now() - 1000).toISOString();
  const first = await pay(buyer, o.id);
  assert.equal(first.status, 201);
  const { s } = await sessionOf(o.id);
  const late = await back(o.id, s);
  assert.equal(late.status, 409);
  assert.equal(late.body.error.code, 'QUOTE_EXPIRED');
  assert.deepEqual(sim.calls, []);

  sim.quoteExpiresAt = null;
  const again = await pay(buyer, o.id);
  assert.equal(again.status, 200);
  assert.equal(again.body.payment.id, first.body.payment.id);
  assert.notEqual(again.body.checkout.expiresAt, first.body.checkout.expiresAt);
  const rows = await db.select().from(paymentSession).where(eq(paymentSession.paymentId, first.body.payment.id));
  assert.deepEqual(rows.map((r) => r.status).sort(), ['pending', 'superseded']);
});

test('el webhook del placeholder no existe con Open Payments', async () => {
  const res = await request(app).post(`${api}/payments/webhook/placeholder`).send({});
  assert.equal(res.status, 404);
});

test('el comprador paga con su principal o elige otra de sus wallets', async () => {
  const { buyer, o } = await setup();
  const [main] = await wallets(buyer);
  const extra = (await link(buyer, `https://buyer.test/otra-${uniq()}`, { name: 'Otra' })).body.wallet;

  const first = await pay(buyer, o.id);
  assert.equal(first.body.checkout.buyerWallet, main.address); // por defecto, la principal
  assert.equal((await pay(buyer, o.id)).body.checkout.redirectUrl, first.body.checkout.redirectUrl); // misma cotización

  const chosen = await authed(request(app).post(`${api}/orders/${o.id}/pay`), buyer.token).set('Idempotency-Key', key()).send({ walletId: extra.id });
  assert.equal(chosen.body.checkout.buyerWallet, extra.address); // otra wallet pide cotización nueva
  assert.equal(chosen.body.payment.id, first.body.payment.id);

  const foreign = (await wallets(await newBuyer(D)))[0];
  const bad = await authed(request(app).post(`${api}/orders/${o.id}/pay`), buyer.token).set('Idempotency-Key', key()).send({ walletId: foreign?.id ?? 999999999 });
  assert.equal(bad.status, 404);
  assert.equal(bad.body.error.code, 'WALLET_NOT_FOUND');
});

test('límite de wallets por usuario', async () => {
  const buyer = await newBuyer(D);
  for (let i = 0; i < 10; i += 1) assert.equal((await link(buyer, `https://ilp.test/w${i}`)).status, 201);
  assert.equal((await link(buyer, 'https://ilp.test/w10')).body.error.code, 'WALLET_LIMIT');
});
