import { test, after, beforeEach } from 'node:test';
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
const uniq = () => `t${Date.now()}${n++}`;
const email = () => `${uniq()}@authtest.local`;

// Cada test usa una IP distinta para no compartir contadores de rate limit.
const post = (path, body, ip = `10.0.${n % 250}.${(n * 7) % 250}`) =>
  request(app).post(`${base}${path}`).set('X-Forwarded-For', ip).send(body);

const lastCode = (to, type) => outbox.findLast((m) => m.to === to && (!type || m.type === type))?.otp;

beforeEach(() => {
  outbox.length = 0;
});

after(async () => {
  await db.delete(user).where(like(user.email, '%@authtest.local'));
  await pool.end();
});

async function signUp(e = email()) {
  const res = await post('/sign-up/email', { email: e, password: PASSWORD, name: 'Test' });
  return { e, res };
}

test('sign-up logs the user in, sends a verification code and verification is optional', async () => {
  const { e, res } = await signUp();
  assert.equal(res.status, 200);
  assert.ok(res.body.token);
  assert.equal(res.body.user.emailVerified, false);
  assert.equal(res.body.user.role, 'buyer');
  const code = lastCode(e, 'email-verification');
  assert.match(code ?? '', /^\d{6}$/);

  const unverifiedLogin = await post('/sign-in/email', { email: e, password: PASSWORD });
  assert.equal(unverifiedLogin.status, 200);
  assert.equal(unverifiedLogin.body.user.emailVerified, false);

  const ok = await post('/email-otp/verify-email', { email: e, otp: code });
  assert.equal(ok.status, 200);

  const login = await post('/sign-in/email', { email: e, password: PASSWORD });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.emailVerified, true);
});

test('sign-up ignores a role sent by the client', async () => {
  const e = email();
  const signup = await post('/sign-up/email', { email: e, password: PASSWORD, name: 'X', role: 'seller' });
  assert.equal(signup.body.user.role, 'buyer');
  const login = await post('/sign-in/email', { email: e, password: PASSWORD });
  assert.equal(login.body.user.role, 'buyer');
});

test('duplicate sign-up is rejected', async () => {
  const { e } = await signUp();
  const again = await post('/sign-up/email', { email: e, password: PASSWORD, name: 'Dup' });
  assert.equal(again.status, 422);
  assert.equal(again.body.code, 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL');
});

test('wrong code is rejected and the code dies after 3 attempts', async () => {
  const { e } = await signUp();
  const real = lastCode(e, 'email-verification');
  const wrong = real === '000000' ? '111111' : '000000';
  for (let i = 0; i < 3; i++) {
    const r = await post('/email-otp/verify-email', { email: e, otp: wrong });
    assert.equal(r.status, 400);
  }
  const late = await post('/email-otp/verify-email', { email: e, otp: real });
  assert.notEqual(late.status, 200);
});

test('login with a one-time code works for a verified user', async () => {
  const { e } = await signUp();
  await post('/email-otp/verify-email', { email: e, otp: lastCode(e, 'email-verification') });

  const send = await post('/email-otp/send-verification-otp', { email: e, type: 'sign-in' });
  assert.equal(send.status, 200);
  const code = lastCode(e, 'sign-in');
  assert.match(code ?? '', /^\d{6}$/);

  const login = await post('/sign-in/email-otp', { email: e, otp: code });
  assert.equal(login.status, 200);
  assert.ok(login.body.token);

  const reuse = await post('/sign-in/email-otp', { email: e, otp: code });
  assert.notEqual(reuse.status, 200);
});

test('resending a code invalidates the previous one', async () => {
  const { e } = await signUp();
  const first = lastCode(e, 'email-verification');
  await post('/email-otp/send-verification-otp', { email: e, type: 'email-verification' });
  const second = lastCode(e, 'email-verification');
  assert.notEqual(first, undefined);
  if (first !== second) {
    const old = await post('/email-otp/verify-email', { email: e, otp: first });
    assert.notEqual(old.status, 200);
  }
  const ok = await post('/email-otp/verify-email', { email: e, otp: second });
  assert.equal(ok.status, 200);
});

test('send-code endpoint is rate limited (429 on the 4th request per minute)', async () => {
  const ip = '203.0.113.77';
  const e = email();
  const statuses = [];
  for (let i = 0; i < 4; i++) {
    const r = await post('/email-otp/send-verification-otp', { email: e, type: 'sign-in' }, ip);
    statuses.push(r.status);
  }
  assert.deepEqual(statuses.slice(0, 3).map((s) => s === 429), [false, false, false]);
  assert.equal(statuses[3], 429);
});

test('existing endpoints keep working next to auth', async () => {
  const res = await request(app).get('/api/v1/health');
  assert.equal(res.status, 200);
});
