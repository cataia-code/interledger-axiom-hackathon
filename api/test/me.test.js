import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq, like } from 'drizzle-orm';
import express from 'express';
import request from 'supertest';
import app from '../src/app.js';
import { db, pool } from '../src/db/index.js';
import { user } from '../src/db/schema.js';
import { requireAuth, requireRole } from '../src/middlewares/auth.js';
import { errorHandler } from '../src/middlewares/errorHandler.js';

let n = 0;
const ip = () => `10.1.${Math.floor(n / 250)}.${n % 250}`;

after(async () => {
  await db.delete(user).where(like(user.email, '%@metest.local'));
  await pool.end();
});

async function register() {
  n++;
  const email = `m${Date.now()}${n}@metest.local`;
  const res = await request(app)
    .post('/api/v1/auth/sign-up/email')
    .set('X-Forwarded-For', ip())
    .send({ email, password: 'Password-12345', name: 'Me' });
  assert.equal(res.status, 200);
  return { email, token: res.body.token, signedToken: res.headers['set-auth-token'] };
}

const me = (token) => {
  const r = request(app).get('/api/v1/me');
  return token ? r.set('Authorization', `Bearer ${token}`) : r;
};

test('GET /me returns the current user with a bearer token', async () => {
  const { email, token } = await register();
  const res = await me(token);
  assert.equal(res.status, 200);
  assert.equal(res.body.user.email, email);
  assert.equal(res.body.user.role, 'buyer');
  assert.deepEqual(Object.keys(res.body.user).sort(), ['email', 'emailVerified', 'id', 'name', 'role']);
});

test('GET /me accepts the signed token from the set-auth-token header', async () => {
  const { email, signedToken } = await register();
  assert.ok(signedToken);
  const res = await me(signedToken);
  assert.equal(res.status, 200);
  assert.equal(res.body.user.email, email);
});

test('GET /me without or with an invalid token returns 401 JSON', async () => {
  for (const token of [undefined, 'not-a-real-token']) {
    const res = await me(token);
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'UNAUTHORIZED');
  }
});

test('sign-out revokes the token', async () => {
  const { token } = await register();
  assert.equal((await me(token)).status, 200);
  const out = await request(app)
    .post('/api/v1/auth/sign-out')
    .set('X-Forwarded-For', ip())
    .set('Authorization', `Bearer ${token}`)
    .send({});
  assert.equal(out.status, 200);
  assert.equal((await me(token)).status, 401);
});

test('requireRole: buyer is rejected (403) and seller is accepted', async () => {
  const { email, token } = await register();
  const guarded = express();
  guarded.get('/sellers-only', requireAuth, requireRole('seller'), (req, res) => res.json({ ok: true }));
  guarded.use(errorHandler);

  const denied = await request(guarded).get('/sellers-only').set('Authorization', `Bearer ${token}`);
  assert.equal(denied.status, 403);
  assert.equal(denied.body.error.code, 'FORBIDDEN');

  const anon = await request(guarded).get('/sellers-only');
  assert.equal(anon.status, 401);

  await db.update(user).set({ role: 'seller' }).where(eq(user.email, email));
  const allowed = await request(guarded).get('/sellers-only').set('Authorization', `Bearer ${token}`);
  assert.equal(allowed.status, 200);
});
