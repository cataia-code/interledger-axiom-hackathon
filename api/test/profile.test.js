import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { like } from 'drizzle-orm';
import request from 'supertest';
import app from '../src/app.js';
import { db, pool } from '../src/db/index.js';
import { user } from '../src/db/schema.js';
import { outbox } from '../src/mail/index.js';

const PASSWORD = 'Password-12345';
const base = '/api/v1/auth';
let n = 0;
const email = (tag) => `${tag}${Date.now()}${n++}@profiletest.local`;
const post = (path, body) => request(app).post(`${base}${path}`).send(body);
const authed = (req, token) => req.set('Authorization', `Bearer ${token}`);
const sellerBody = (e) => ({
  email: e,
  password: PASSWORD,
  name: 'Owner',
  organization: {
    legalName: 'Panadería Luna S.A.',
    taxId: `TAX-${Date.now()}-${n++}`,
    legalId: `LEG-${Date.now()}-${n++}`,
    country: 'PA',
    legalAddress: 'Calle 50, Ciudad de Panamá',
  },
  store: {
    name: 'Sucursal Centro',
    address: 'Av. Central 123',
    city: 'Panamá',
    latitude: 8.98,
    longitude: -79.51,
    legalId: 'SUC-1',
    currency: 'USD',
  },
});
const newSeller = async () => (await post('/seller/sign-up', sellerBody(email('s')))).body;

after(async () => {
  await db.delete(user).where(like(user.email, '%@profiletest.local'));
  await pool.end();
});

test('PATCH /me edits name and phone and validates input', async () => {
  const { token } = (await post('/buyer/sign-up', { email: email('a'), password: PASSWORD, name: 'Ana' })).body;
  const ok = await authed(request(app).patch('/api/v1/me'), token).send({ name: ' Ana María ', phone: '+507 555 0100' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.name, 'Ana María');
  assert.equal(ok.body.user.phone, '+507 555 0100');
  const me = await authed(request(app).get('/api/v1/me'), token);
  assert.equal(me.body.user.phone, '+507 555 0100');

  const cleared = await authed(request(app).patch('/api/v1/me'), token).send({ phone: null });
  assert.equal(cleared.body.user.phone, null);

  const bad = await authed(request(app).patch('/api/v1/me'), token).send({ name: '' });
  assert.equal(bad.body.error.code, 'INVALID_NAME');
  const empty = await authed(request(app).patch('/api/v1/me'), token).send({ role: 'seller' });
  assert.equal(empty.body.error.code, 'EMPTY_UPDATE');
  assert.equal((await request(app).patch('/api/v1/me').send({ name: 'x' })).status, 401);
});

test('password reset with a one-time code', async () => {
  const e = email('b');
  await post('/buyer/sign-up', { email: e, password: PASSWORD, name: 'B' });
  const req = await post('/email-otp/request-password-reset', { email: e });
  assert.equal(req.status, 200);
  const otp = outbox.findLast((m) => m.to === e && m.type === 'forget-password').otp;
  const bad = await post('/email-otp/reset-password', { email: e, otp: '000000', password: 'New-password-123' });
  assert.equal(bad.status, 400);
  const ok = await post('/email-otp/reset-password', { email: e, otp, password: 'New-password-123' });
  assert.equal(ok.status, 200);
  assert.equal((await post('/buyer/sign-in', { email: e, password: PASSWORD })).status, 401);
  assert.equal((await post('/buyer/sign-in', { email: e, password: 'New-password-123' })).status, 200);
});

test('seller reads and edits the organization (taxId, legalId and country are immutable)', async () => {
  const { token } = await newSeller();
  const got = await authed(request(app).get('/api/v1/seller/organization'), token);
  assert.equal(got.status, 200);
  assert.equal(got.body.organization.country, 'PA');

  const res = await authed(request(app).patch('/api/v1/seller/organization'), token).send({
    tradeName: 'Luna',
    phone: '555',
    taxId: 'CHANGED',
    country: 'CO',
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.organization.tradeName, 'Luna');
  assert.equal(res.body.organization.taxId, got.body.organization.taxId);
  assert.equal(res.body.organization.country, 'PA');

  const bad = await authed(request(app).patch('/api/v1/seller/organization'), token).send({ legalName: 'x' });
  assert.equal(bad.body.error.code, 'INVALID_LEGAL_NAME');
  const empty = await authed(request(app).patch('/api/v1/seller/organization'), token).send({ taxId: 'x' });
  assert.equal(empty.body.error.code, 'EMPTY_UPDATE');
});

test('seller edits, pauses and closes the store; the public view follows', async () => {
  const { token, store } = await newSeller();
  const url = `/api/v1/stores/${store.id}`;
  const pub = await request(app).get(url);
  assert.equal(pub.status, 200);
  assert.equal(pub.body.store.name, 'Sucursal Centro');
  assert.equal(pub.body.store.legalId, undefined);

  const edit = await authed(request(app).patch('/api/v1/seller/store'), token).send({
    description: 'Pan fresco',
    latitude: 9.1,
    currency: 'EUR',
    status: 'paused',
  });
  assert.equal(edit.status, 200);
  assert.equal(edit.body.store.description, 'Pan fresco');
  assert.equal(edit.body.store.latitude, 9.1);
  assert.equal(edit.body.store.currency, 'USD');
  assert.equal(edit.body.store.status, 'paused');
  assert.equal((await request(app).get(url)).body.store.status, 'paused');

  assert.equal((await authed(request(app).patch('/api/v1/seller/store'), token).send({ status: 'closed' })).body.error.code, 'INVALID_STATUS');
  assert.equal((await authed(request(app).patch('/api/v1/seller/store'), token).send({ latitude: 100 })).body.error.code, 'INVALID_LATITUDE');

  const closed = await authed(request(app).delete('/api/v1/seller/store'), token);
  assert.equal(closed.status, 200);
  assert.equal(closed.body.store.status, 'closed');
  assert.equal((await request(app).get(url)).status, 404);
  assert.equal((await authed(request(app).get('/api/v1/seller/store'), token)).body.error.code, 'STORE_REQUIRED');
});

test('seller routes require a seller; the public store 404s for unknown ids', async () => {
  assert.equal((await request(app).get('/api/v1/seller/store')).status, 401);
  const { token } = (await post('/buyer/sign-up', { email: email('c'), password: PASSWORD, name: 'B' })).body;
  assert.equal((await authed(request(app).get('/api/v1/seller/store'), token)).status, 403);
  assert.equal((await request(app).get('/api/v1/stores/99999999')).status, 404);
  assert.equal((await request(app).get('/api/v1/stores/abc')).status, 404);
});
