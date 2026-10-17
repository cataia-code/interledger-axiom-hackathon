import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { like } from 'drizzle-orm';
import request from 'supertest';
import app from '../src/app.js';
import { db, pool } from '../src/db/index.js';
import { user } from '../src/db/schema.js';
import { PASSWORD, authed, post, sellerBody, uniq } from './helpers.js';

const D = 'countrytest.local';
const api = '/api/v1';
const email = () => `u${uniq()}@${D}`;
const me = (token) => authed(request(app).get(`${api}/me`), token);
const patch = (token, body) => authed(request(app).patch(`${api}/me`), token).send(body);

after(async () => {
  await db.delete(user).where(like(user.email, `%@${D}`));
  await pool.end();
});

test('buyer sign-up stores the country (uppercased) and sign-in and /me return it', async () => {
  const e = email();
  const up = await post('/buyer/sign-up', { email: e, password: PASSWORD, name: 'Ana', country: 'co' });
  assert.equal(up.status, 201);
  assert.equal(up.body.user.country, 'CO');
  assert.equal((await me(up.body.token)).body.user.country, 'CO');
  const inn = await post('/buyer/sign-in', { email: e, password: PASSWORD });
  assert.equal(inn.body.user.country, 'CO');
  assert.equal(inn.body.user.role, 'buyer');
});

test('country is optional at sign-up and null when omitted', async () => {
  const up = await post('/buyer/sign-up', { email: email(), password: PASSWORD, name: 'Sin país' });
  assert.equal(up.status, 201);
  assert.equal(up.body.user.country, null);
  assert.equal((await me(up.body.token)).body.user.country, null);
});

test('seller sign-up accepts the user country apart from the organization country', async () => {
  const body = { ...sellerBody(email()), country: 'PA' };
  body.organization.country = 'CO';
  const up = await post('/seller/sign-up', body);
  assert.equal(up.status, 201);
  assert.equal(up.body.user.role, 'seller');
  assert.equal(up.body.user.country, 'PA');
  assert.equal(up.body.organization.country, 'CO');
  const inn = await post('/seller/sign-in', { email: body.email, password: PASSWORD });
  assert.equal(inn.body.user.country, 'PA');
});

test('an invalid country is rejected before creating the account', async () => {
  for (const country of ['Colombia', 'C', 'XX', 'ZZ', '12', 5]) {
    const e = email();
    const res = await post('/buyer/sign-up', { email: e, password: PASSWORD, name: 'X', country });
    assert.equal(res.status, 400, String(country));
    assert.equal(res.body.error.code, 'INVALID_COUNTRY');
    assert.equal((await post('/buyer/sign-in', { email: e, password: PASSWORD })).status, 401, 'no account was created');
  }
  const seller = { ...sellerBody(email()), country: 'nope' };
  const res = await post('/seller/sign-up', seller);
  assert.equal(res.body.error.code, 'INVALID_COUNTRY');
  assert.equal((await post('/seller/sign-in', { email: seller.email, password: PASSWORD })).status, 401);
});

test('PATCH /me sets, changes and clears the country', async () => {
  const { token } = (await post('/buyer/sign-up', { email: email(), password: PASSWORD, name: 'Ana' })).body;
  assert.equal((await patch(token, { country: 'mx' })).body.user.country, 'MX');
  assert.equal((await me(token)).body.user.country, 'MX');
  assert.equal((await patch(token, { country: 'ES', name: 'Ana B' })).body.user.country, 'ES');
  assert.equal((await patch(token, { country: null })).body.user.country, null);
  assert.equal((await patch(token, { country: 'Spain' })).body.error.code, 'INVALID_COUNTRY');
  assert.equal((await patch(token, {})).body.error.code, 'EMPTY_UPDATE');
});
