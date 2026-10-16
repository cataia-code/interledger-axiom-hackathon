import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import app from '../src/app.js';
import { parseCorsOrigin, parseTrustProxy } from '../src/config/index.js';
import { onPoolError, pool } from '../src/db/index.js';
import { limiter } from '../src/middlewares/rateLimit.js';
import { errorHandler } from '../src/middlewares/errorHandler.js';
import { db } from '../src/db/index.js';
import { user } from '../src/db/schema.js';
import { like } from 'drizzle-orm';
import { newBuyer, newSeller } from './helpers.js';

const D = 'hardeningtest.local';

after(async () => {
  await db.delete(user).where(like(user.email, `%@${D}`));
  await pool.end();
});

test('CORS_ORIGIN: required in production, accepts a list, open only outside production', () => {
  assert.throws(() => parseCorsOrigin(undefined, 'production'), /CORS_ORIGIN is required/);
  assert.throws(() => parseCorsOrigin('  ', 'production'), /CORS_ORIGIN is required/);
  assert.throws(() => parseCorsOrigin('*', 'production'), /cannot be/);
  assert.throws(() => parseCorsOrigin('https://a.com,*', 'production'), /cannot be/);
  assert.equal(parseCorsOrigin(undefined, 'development'), '*');
  assert.equal(parseCorsOrigin('*', 'development'), '*');
  assert.equal(parseCorsOrigin('https://app.example.com', 'production'), 'https://app.example.com');
  assert.deepEqual(parseCorsOrigin('https://a.com, https://b.com', 'production'), ['https://a.com', 'https://b.com']);
});

test('TRUST_PROXY: empty means no proxy; numbers and "true" are accepted; junk is rejected', () => {
  assert.equal(parseTrustProxy(undefined), false);
  assert.equal(parseTrustProxy(''), false);
  assert.equal(parseTrustProxy('1'), 1);
  assert.equal(parseTrustProxy('true'), true);
  assert.throws(() => parseTrustProxy('-1'));
  assert.throws(() => parseTrustProxy('many'));
  assert.equal(app.get('trust proxy'), false);
});

test('an error on an idle database connection does not crash the process', async () => {
  const original = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args.join(' '));
  try {
    assert.ok(pool.listeners('error').includes(onPoolError));
    pool.emit('error', new Error('terminating connection due to administrator command'));
  } finally {
    console.error = original;
  }
  assert.match(logged[0], /idle client error/);
  assert.equal((await pool.query('select 1 as n')).rows[0].n, 1);
});

test('limiter: returns 429 RATE_LIMITED after the maximum, counted per session token', async () => {
  const small = express();
  small.use(limiter(2, { scale: 1 }));
  small.get('/x', (req, res) => res.json({ ok: true }));
  small.use(errorHandler);
  const hit = (token) => request(small).get('/x').set('Authorization', `Bearer ${token}`);
  assert.equal((await hit('a')).status, 200);
  assert.equal((await hit('a')).status, 200);
  const blocked = await hit('a');
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.error.code, 'RATE_LIMITED');
  assert.equal((await hit('b')).status, 200); // otra sesión, mismo IP: contador propio
  assert.equal((await request(small).get('/x')).status, 200); // anónimo: por IP
});

test('the API applies rate limits to reads, writes and the sensitive routes', async () => {
  const policy = (res) => res.headers['ratelimit-policy'];
  assert.match(policy(await request(app).get('/api/v1/health')), /^600000;/);
  assert.match(policy(await request(app).post('/api/v1/payments/webhook/placeholder').send({})), /^300000;/);
  const buyer = await newBuyer(D);
  const seller = await newSeller(D);
  const as = (req, who) => req.set('Authorization', `Bearer ${who.token}`);
  assert.match(policy(await as(request(app).post('/api/v1/orders'), buyer)), /^10000;/);
  assert.match(policy(await as(request(app).post('/api/v1/orders/1/pay'), buyer)), /^10000;/);
  assert.match(policy(await as(request(app).post('/api/v1/seller/items/1/images'), seller)), /^20000;/);
  assert.match(policy(await as(request(app).patch('/api/v1/me'), buyer)), /^120000;/);
});

test('search and price-order indexes exist (pg_trgm)', async () => {
  const idx = (await pool.query(`select indexname from pg_indexes where tablename = 'item'`)).rows.map((r) => r.indexname);
  for (const name of ['item_public_price_idx', 'item_name_trgm_idx', 'item_description_trgm_idx', 'item_store_idx']) assert.ok(idx.includes(name), name);
  assert.equal((await pool.query(`select 1 from pg_extension where extname = 'pg_trgm'`)).rowCount, 1);
});
