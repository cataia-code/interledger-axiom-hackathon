import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq, like } from 'drizzle-orm';
import express from 'express';
import request from 'supertest';
import app from '../src/app.js';
import { db, pool } from '../src/db/index.js';
import { user } from '../src/db/schema.js';
import { organization, store } from '../src/db/business.js';
import { outbox } from '../src/mail/index.js';
import { createRoleAuthRouter } from '../src/routes/roleAuth.js';
import { errorHandler } from '../src/middlewares/errorHandler.js';

const PASSWORD = 'Password-12345';
const base = '/api/v1/auth';
let n = 0;
const email = (tag) => `${tag}${Date.now()}${n++}@sellertest.local`;
const post = (path, body) => request(app).post(`${base}${path}`).send(body);
const me = (token) => request(app).get('/api/v1/me').set('Authorization', `Bearer ${token}`);
const orgData = (taxId = `TAX-${Date.now()}-${n++}`, legalId = `LEG-${Date.now()}-${n++}`) => ({
  legalName: 'Panadería Luna S.A.',
  tradeName: 'Luna',
  taxId,
  legalId,
  country: 'pa',
  legalAddress: 'Calle 50, Ciudad de Panamá',
  phone: '+507 555 0100',
});
const storeData = (extra = {}) => ({
  name: '  Sucursal Centro  ',
  description: 'Cosas buenas',
  address: 'Av. Central 123',
  city: 'Ciudad de Panamá',
  latitude: 8.9824,
  longitude: -79.5199,
  legalId: 'SUC-001',
  currency: 'usd',
  ...extra,
});
const sellerBody = (e, extra = {}) => ({
  email: e,
  password: PASSWORD,
  name: 'Owner',
  organization: orgData(),
  store: storeData(),
  ...extra,
});
const withAuth = (req, token) => req.set('Authorization', `Bearer ${token}`);

after(async () => {
  await db.delete(user).where(like(user.email, '%@sellertest.local'));
  await pool.end();
});

test('seller sign-up creates user, organization and first store together', async () => {
  const e = email('a');
  const res = await post('/seller/sign-up', sellerBody(e));
  assert.equal(res.status, 201);
  assert.ok(res.body.token);
  assert.equal(res.body.user.role, 'seller');
  assert.equal(res.body.organization.legalName, 'Panadería Luna S.A.');
  assert.equal(res.body.organization.country, 'PA');
  assert.equal(res.body.store.name, 'Sucursal Centro');
  assert.equal(res.body.store.currency, 'USD');
  assert.equal(res.body.store.latitude, 8.9824);
  assert.equal(res.body.store.status, 'active');
  assert.equal(typeof res.body.store.id, 'number');
  assert.equal(typeof res.body.user.id, 'number');
  assert.equal(res.body.store.organizationId, res.body.organization.id);
  const orgs = await db.select().from(organization).where(eq(organization.userId, res.body.user.id));
  assert.equal(orgs.length, 1);
  const stores = await db.select().from(store).where(eq(store.organizationId, orgs[0].id));
  assert.equal(stores.length, 1);
  assert.equal((await me(res.body.token)).body.user.role, 'seller');
});

test('seller sign-up with invalid data creates nothing', async () => {
  const cases = [
    [{ organization: undefined }, 'INVALID_LEGAL_NAME'],
    [{ organization: { ...orgData(), country: 'PAN' } }, 'INVALID_COUNTRY'],
    [{ organization: { ...orgData(), taxId: 'x' } }, 'INVALID_TAX_ID'],
    [{ organization: { ...orgData(), legalAddress: 'abc' } }, 'INVALID_LEGAL_ADDRESS'],
    [{ organization: { ...orgData(), legalId: '' } }, 'INVALID_LEGAL_ID'],
    [{ store: undefined }, 'INVALID_NAME'],
    [{ store: storeData({ name: 'a' }) }, 'INVALID_NAME'],
    [{ store: storeData({ description: 'd'.repeat(501) }) }, 'INVALID_DESCRIPTION'],
    [{ store: storeData({ address: '' }) }, 'INVALID_ADDRESS'],
    [{ store: storeData({ city: '' }) }, 'INVALID_CITY'],
    [{ store: storeData({ latitude: 91 }) }, 'INVALID_LATITUDE'],
    [{ store: storeData({ longitude: 'abc' }) }, 'INVALID_LONGITUDE'],
    [{ store: storeData({ legalId: 'x' }) }, 'INVALID_LEGAL_ID'],
    [{ store: storeData({ currency: 'DOLLAR' }) }, 'INVALID_CURRENCY'],
  ];
  for (const [extra, code] of cases) {
    const e = email('b');
    const res = await post('/seller/sign-up', sellerBody(e, extra));
    assert.equal(res.status, 400, code);
    assert.equal(res.body.error.code, code);
    assert.equal((await db.select().from(user).where(eq(user.email, e))).length, 0);
  }
});

test('a repeated tax id is rejected and the new account is rolled back', async () => {
  const taxId = `DUP-${Date.now()}`;
  const first = await post('/seller/sign-up', sellerBody(email('t1'), { organization: orgData(taxId) }));
  assert.equal(first.status, 201);
  const e = email('t2');
  const second = await post('/seller/sign-up', sellerBody(e, { organization: orgData(taxId) }));
  assert.equal(second.status, 409);
  assert.equal(second.body.error.code, 'TAX_ID_ALREADY_EXISTS');
  assert.equal((await db.select().from(user).where(eq(user.email, e))).length, 0);
});

test('seller sign-up with an existing email is rejected and keeps the original account', async () => {
  const e = email('c');
  await post('/buyer/sign-up', { email: e, password: PASSWORD, name: 'B' });
  const res = await post('/seller/sign-up', sellerBody(e));
  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL');
  const [row] = await db.select().from(user).where(eq(user.email, e));
  assert.equal(row.role, 'buyer');
});

test('seller login accepts sellers (password and code) and returns a usable token', async () => {
  const e = email('d');
  await post('/seller/sign-up', sellerBody(e));
  const login = await post('/seller/sign-in', { email: e, password: PASSWORD });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.role, 'seller');
  assert.equal((await me(login.body.token)).status, 200);

  await post('/email-otp/send-verification-otp', { email: e, type: 'sign-in' });
  const code = outbox.findLast((m) => m.to === e && m.type === 'sign-in').otp;
  const byCode = await post('/seller/sign-in/otp', { email: e, otp: code });
  assert.equal(byCode.status, 200);
  assert.equal(byCode.body.user.role, 'seller');
});

test('a buyer cannot use the seller login, and a seller cannot use the buyer login', async () => {
  const buyer = email('e');
  const seller = email('f');
  await post('/buyer/sign-up', { email: buyer, password: PASSWORD, name: 'B' });
  await post('/seller/sign-up', sellerBody(seller));

  const asSeller = await post('/seller/sign-in', { email: buyer, password: PASSWORD });
  assert.equal(asSeller.status, 403);
  assert.equal(asSeller.body.error.code, 'WRONG_ROLE');
  assert.equal(asSeller.body.token, undefined);

  const asBuyer = await post('/buyer/sign-in', { email: seller, password: PASSWORD });
  assert.equal(asBuyer.status, 403);
  assert.equal(asBuyer.body.error.code, 'WRONG_ROLE');

  const ok = await post('/buyer/sign-in', { email: buyer, password: PASSWORD });
  assert.equal(ok.status, 200);
});

test('a rejected role login leaves no live session behind', async () => {
  const seller = email('g');
  await post('/seller/sign-up', sellerBody(seller));
  const [row] = await db.select().from(user).where(eq(user.email, seller));
  const count = async () => (await pool.query('select count(*)::int as n from session where user_id = $1', [row.id])).rows[0].n;
  const initial = await count();
  await post('/buyer/sign-in', { email: seller, password: PASSWORD });
  assert.equal(await count(), initial);
});

test('wrong password and unknown email give the same 401', async () => {
  const e = email('h');
  await post('/seller/sign-up', sellerBody(e));
  const wrong = await post('/seller/sign-in', { email: e, password: 'nope-nope-nope' });
  const unknown = await post('/seller/sign-in', { email: email('zz'), password: PASSWORD });
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.equal(wrong.body.error.code, unknown.body.error.code);
});

test('a seller without a store or without an organization cannot log in as seller', async () => {
  const e = email('i');
  const signup = await post('/seller/sign-up', sellerBody(e));
  await db.delete(store).where(eq(store.organizationId, signup.body.organization.id)); // estado inconsistente forzado
  const noStore = await post('/seller/sign-in', { email: e, password: PASSWORD });
  assert.equal(noStore.status, 403);
  assert.equal(noStore.body.error.code, 'STORE_REQUIRED');

  await db.delete(organization).where(eq(organization.id, signup.body.organization.id));
  const noOrg = await post('/seller/sign-in', { email: e, password: PASSWORD });
  assert.equal(noOrg.status, 403);
  assert.equal(noOrg.body.error.code, 'ORGANIZATION_REQUIRED');
});

test('a repeated legal id is rejected', async () => {
  const legalId = `DUPL-${Date.now()}`;
  assert.equal((await post('/seller/sign-up', sellerBody(email('n1'), { organization: orgData(undefined, legalId) }))).status, 201);
  const second = await post('/seller/sign-up', sellerBody(email('n2'), { organization: orgData(undefined, legalId) }));
  assert.equal(second.status, 409);
  assert.equal(second.body.error.code, 'LEGAL_ID_ALREADY_EXISTS');
});

test('an organization has a single store: the database refuses a second one', async () => {
  const { body } = await post('/seller/sign-up', sellerBody(email('k')));
  await assert.rejects(
    db.insert(store).values({ organizationId: body.organization.id, ...storeData(), currency: 'USD', legalId: 'X-2' }),
  );
  const gone = await withAuth(request(app).post('/api/v1/stores'), body.token).send(storeData());
  assert.equal(gone.status, 404);
});

test('deleting the user deletes the organization and its stores', async () => {
  const { body } = await post('/seller/sign-up', sellerBody(email('m')));
  await db.delete(user).where(eq(user.id, body.user.id));
  assert.equal((await db.select().from(organization).where(eq(organization.id, body.organization.id))).length, 0);
  assert.equal((await db.select().from(store).where(eq(store.organizationId, body.organization.id))).length, 0);
});

test('role routes are rate limited', async () => {
  const limited = express();
  limited.use('/api/v1/auth', createRoleAuthRouter({ max: 2 }));
  limited.use(errorHandler);
  const codes = [];
  for (let i = 0; i < 3; i++) {
    const r = await request(limited).post('/api/v1/auth/buyer/sign-in').send({ email: 'x@y.co', password: 'abcdefgh' });
    codes.push(r.status);
  }
  assert.equal(codes[2], 429);
  assert.notEqual(codes[1], 429);
});
