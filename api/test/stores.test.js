import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq, like } from 'drizzle-orm';
import request from 'supertest';
import app from '../src/app.js';
import { db, pool } from '../src/db/index.js';
import { user } from '../src/db/schema.js';
import { store } from '../src/db/stores.js';

let n = 0;

after(async () => {
  await db.delete(user).where(like(user.email, '%@storetest.local'));
  await pool.end();
});

async function register() {
  n++;
  const res = await request(app)
    .post('/api/v1/auth/sign-up/email')
    .set('X-Forwarded-For', `10.2.${Math.floor(n / 250)}.${n % 250}`)
    .send({ email: `s${Date.now()}${n}@storetest.local`, password: 'Password-12345', name: 'Owner' });
  assert.equal(res.status, 200);
  return { token: res.body.token, id: res.body.user.id };
}

const create = (token, body) => {
  const r = request(app).post('/api/v1/stores');
  return (token ? r.set('Authorization', `Bearer ${token}`) : r).send(body);
};
const me = (token) => request(app).get('/api/v1/me').set('Authorization', `Bearer ${token}`);

test('POST /stores requires authentication', async () => {
  const res = await create(undefined, { name: 'Tienda' });
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'UNAUTHORIZED');
});

test('POST /stores validates the input', async () => {
  const { token } = await register();
  for (const body of [{}, { name: ' ' }, { name: 'a' }, { name: 'x'.repeat(81) }, { name: 5 }]) {
    const res = await create(token, body);
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INVALID_NAME');
  }
  const bad = await create(token, { name: 'Tienda', description: 'd'.repeat(501) });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error.code, 'INVALID_DESCRIPTION');
  assert.equal((await me(token)).body.user.role, 'buyer');
});

test('POST /stores creates the store and promotes the user to seller', async () => {
  const { token, id } = await register();
  const res = await create(token, { name: '  Mi Tienda  ', description: 'Cosas buenas' });
  assert.equal(res.status, 201);
  assert.equal(res.body.store.name, 'Mi Tienda');
  assert.equal(res.body.store.description, 'Cosas buenas');
  assert.deepEqual(res.body.user, { id, role: 'seller' });
  assert.equal((await me(token)).body.user.role, 'seller');
});

test('description is optional', async () => {
  const { token } = await register();
  const res = await create(token, { name: 'Sin descripción' });
  assert.equal(res.status, 201);
  assert.equal(res.body.store.description, null);
});

test('a user cannot create a second store', async () => {
  const { token } = await register();
  assert.equal((await create(token, { name: 'Primera' })).status, 201);
  const again = await create(token, { name: 'Segunda' });
  assert.equal(again.status, 409);
  assert.equal(again.body.error.code, 'STORE_ALREADY_EXISTS');
});

test('concurrent requests create exactly one store', async () => {
  const { token, id } = await register();
  const results = await Promise.all([1, 2, 3].map((i) => create(token, { name: `Carrera ${i}` })));
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409, 409]);
  const rows = await db.select().from(store).where(eq(store.userId, id));
  assert.equal(rows.length, 1);
});

test('deleting the user deletes the store', async () => {
  const { token, id } = await register();
  await create(token, { name: 'Efímera' });
  await db.delete(user).where(eq(user.id, id));
  assert.equal((await db.select().from(store).where(eq(store.userId, id))).length, 0);
});
