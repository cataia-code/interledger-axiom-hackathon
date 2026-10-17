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
  assert.equal(up.body.user.countryName, 'Colombia');
  const profile = (await me(up.body.token)).body.user;
  assert.deepEqual([profile.country, profile.countryName], ['CO', 'Colombia']);
  const inn = await post('/buyer/sign-in', { email: e, password: PASSWORD });
  assert.deepEqual([inn.body.user.country, inn.body.user.countryName], ['CO', 'Colombia']);
  assert.equal(inn.body.user.role, 'buyer');
});

test('country is optional at sign-up and null when omitted', async () => {
  const up = await post('/buyer/sign-up', { email: email(), password: PASSWORD, name: 'Sin país' });
  assert.equal(up.status, 201);
  assert.equal(up.body.user.country, null);
  assert.equal(up.body.user.countryName, null);
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
  for (const country of ['C', 'XX', 'ZZ', '12', 5, 'EU', 'UK', 'COL', 'Narnia']) {
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

test('a country can be given by name (Spanish or English, any case or accent) and is stored as its code', async () => {
  const cases = [['Colombia', 'CO', 'Colombia'], ['panamá', 'PA', 'Panamá'], ['PANAMA', 'PA', 'Panamá'], ['Spain', 'ES', 'España'], ['estados unidos', 'US', 'Estados Unidos'], ['USA', 'US', 'Estados Unidos']];
  for (const [given, code, name] of cases) {
    const up = await post('/buyer/sign-up', { email: email(), password: PASSWORD, name: 'N', country: given });
    assert.equal(up.status, 201, given);
    assert.deepEqual([up.body.user.country, up.body.user.countryName], [code, name], given);
  }
  const { token } = (await post('/buyer/sign-up', { email: email(), password: PASSWORD, name: 'N' })).body;
  const patched = await patch(token, { country: 'México' });
  assert.deepEqual([patched.body.user.country, patched.body.user.countryName], ['MX', 'México']);
});

test('GET /countries lists the 249 official countries with Spanish names', async () => {
  const res = await request(app).get(`${api}/countries`);
  assert.equal(res.status, 200);
  assert.equal(res.body.countries.length, 249);
  assert.deepEqual(res.body.countries.find((c) => c.code === 'CO'), { code: 'CO', name: 'Colombia' });
  assert.deepEqual(res.body.countries.find((c) => c.code === 'ES'), { code: 'ES', name: 'España' });
  for (const code of ['EU', 'UN', 'UK', 'XA']) assert.equal(res.body.countries.some((c) => c.code === code), false, code);
  const names = res.body.countries.map((c) => c.name);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, 'es')), 'sorted by name');
  assert.match(res.headers['cache-control'], /max-age/);
});

test('PATCH /me sets, changes and clears the country', async () => {
  const { token } = (await post('/buyer/sign-up', { email: email(), password: PASSWORD, name: 'Ana' })).body;
  assert.equal((await patch(token, { country: 'mx' })).body.user.country, 'MX');
  assert.equal((await me(token)).body.user.country, 'MX');
  assert.equal((await patch(token, { country: 'ES', name: 'Ana B' })).body.user.country, 'ES');
  assert.equal((await patch(token, { country: null })).body.user.country, null);
  assert.equal((await patch(token, { country: 'Narnia' })).body.error.code, 'INVALID_COUNTRY');
  assert.equal((await patch(token, {})).body.error.code, 'EMPTY_UPDATE');
});
