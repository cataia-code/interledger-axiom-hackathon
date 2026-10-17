import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { like } from 'drizzle-orm';
import request from 'supertest';
import app from '../src/app.js';
import { db, pool } from '../src/db/index.js';
import { user } from '../src/db/schema.js';
import { authed, newBuyer, newSeller, uniq } from './helpers.js';

const D = 'storewalletstest.local';
const api = '/api/v1';

after(async () => {
  await db.delete(user).where(like(user.email, `%@${D}`));
  await pool.end();
});

const link = (who, name, primary) =>
  authed(request(app).post(`${api}/me/wallets`), who.token).send({ address: `https://wallet.example.test/${uniq()}`, name, ...(primary && { primary: true }) });
const detail = async (id) => (await request(app).get(`${api}/stores/${id}`)).body.store;
const listed = async (id, q = {}) => {
  const res = await request(app).get(`${api}/stores`).query({ limit: 50, ...q });
  return res.body.stores.find((s) => s.id === id);
};

test('a store shows the wallets of its owner, primary first, in the detail and in both listings', async () => {
  const seller = await newSeller(D);
  const other = await newSeller(D);
  assert.deepEqual((await detail(seller.store.id)).wallets, [], 'no wallets yet');
  assert.deepEqual((await listed(seller.store.id)).wallets, []);

  const first = (await link(seller, 'Caja principal')).body.wallet;
  const second = (await link(seller, 'Dólares', true)).body.wallet;
  assert.ok(first.id && second.id);
  await link(other, 'De otra tienda');
  await link(await newBuyer(D), 'De un comprador');

  const d = await detail(seller.store.id);
  assert.equal(d.wallets.length, 2);
  assert.deepEqual(d.wallets.map((w) => w.name), ['Dólares', 'Caja principal'], 'the primary comes first');
  assert.deepEqual(d.wallets.map((w) => w.isPrimary), [true, false]);
  assert.deepEqual(Object.keys(d.wallets[0]).sort(), ['address', 'assetCode', 'assetScale', 'id', 'isPrimary', 'name']);
  assert.deepEqual([d.wallets[0].id, d.wallets[0].address, d.wallets[0].assetCode, d.wallets[0].assetScale], [second.id, second.address, second.assetCode, second.assetScale]);
  assert.equal(d.currency, 'USD', 'the store currency is still there');

  // El listado (por fecha y por puntaje) trae lo mismo, y cada tienda solo las suyas.
  for (const q of [{}, { sort: 'score' }]) {
    const entry = await listed(seller.store.id, q);
    assert.deepEqual(entry.wallets, d.wallets, JSON.stringify(q));
    assert.equal((await listed(other.store.id, q)).wallets.length, 1);
  }
  assert.equal((await listed(other.store.id)).wallets[0].name, 'De otra tienda');
});

test('the wallets of a store follow the owner: rename, change primary and remove', async () => {
  const seller = await newSeller(D);
  const a = (await link(seller, 'Una')).body.wallet;
  const b = (await link(seller, 'Dos')).body.wallet;
  assert.deepEqual((await detail(seller.store.id)).wallets.map((w) => w.id), [a.id, b.id]);

  await authed(request(app).patch(`${api}/me/wallets/${b.id}`), seller.token).send({ name: 'Renombrada', primary: true });
  let wallets = (await detail(seller.store.id)).wallets;
  assert.deepEqual(wallets.map((w) => [w.id, w.name, w.isPrimary]), [[b.id, 'Renombrada', true], [a.id, 'Una', false]]);

  await authed(request(app).delete(`${api}/me/wallets/${b.id}`), seller.token);
  wallets = (await detail(seller.store.id)).wallets;
  assert.deepEqual(wallets.map((w) => [w.id, w.isPrimary]), [[a.id, true]], 'the remaining wallet becomes primary');

  assert.equal((await request(app).get(`${api}/stores/999999`)).body.error.code, 'STORE_NOT_FOUND');
});
