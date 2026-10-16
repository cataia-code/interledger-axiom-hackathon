import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMailer, parseFrom, renderOtpEmail, outbox } from '../src/mail/index.js';

const fakeClient = (result) => {
  const calls = [];
  return { calls, emails: { send: async (payload) => (calls.push(payload), result) } };
};

test('production with an API key sends through Resend with from, subject, text and html', async () => {
  const client = fakeClient({ data: { id: 'em_123' }, error: null });
  const mailer = createMailer({ env: 'production', resendApiKey: 're_test', from: 'Axiom <no-reply@axiom.example>', client });
  assert.equal(mailer.name, 'resend');
  const { text, html } = renderOtpEmail({ otp: '482913', type: 'sign-in' });
  const out = await mailer.send({ to: 'ana@ejemplo.com', subject: 'Tu código', text, html, type: 'sign-in', otp: '482913' });
  assert.equal(out.id, 'em_123');
  assert.deepEqual(Object.keys(client.calls[0]).sort(), ['from', 'html', 'subject', 'text', 'to']); // no se filtran type ni otp
  assert.equal(client.calls[0].from, 'Axiom <no-reply@axiom.example>');
  assert.match(client.calls[0].text, /482913/);
  assert.match(client.calls[0].html, /482913/);
});

test('a Resend error rejects so the caller can log it', async () => {
  const client = fakeClient({ data: null, error: { name: 'validation_error', message: 'The domain is not verified' } });
  const mailer = createMailer({ env: 'production', resendApiKey: 're_test', client });
  await assert.rejects(mailer.send({ to: 'a@b.co', subject: 's', text: 't', html: 'h' }), /validation_error: The domain is not verified/);
});

test('without an API key (or outside production) the console transport is used and codes are not printed in production', async () => {
  assert.equal(createMailer({ env: 'production' }).name, 'console');
  assert.equal(createMailer({ env: 'development', resendApiKey: 're_test' }).name, 'console');
  const lines = [];
  const original = console.log;
  console.log = (...args) => lines.push(args.join(' '));
  try {
    await createMailer({ env: 'production' }).send({ to: 'a@b.co', subject: 'Código', text: 'Tu código es 999999', html: '<b>999999</b>' });
  } finally {
    console.log = original;
  }
  assert.equal(lines.length, 1);
  assert.ok(!lines[0].includes('999999'));
  assert.match(lines[0], /not delivered/);
  assert.ok(outbox.some((m) => m.to === 'a@b.co'));
});

test('the code email is escaped, in Spanish and says it expires in 10 minutes', () => {
  const { text, html } = renderOtpEmail({ otp: '<b>1</b>', type: 'forget-password' });
  assert.match(text, /restablecer tu contraseña/);
  assert.match(text, /10 minutos/);
  assert.ok(!html.includes('<b>1</b>'));
  assert.match(html, /&lt;b&gt;1&lt;\/b&gt;/);
});

const fakeFetch = (status, json) => {
  const calls = [];
  const impl = async (url, init) => (calls.push({ url, init }), { ok: status < 300, status, json: async () => json });
  return { calls, impl };
};

test('Brevo (free plan, no own domain) is used with BREVO_API_KEY and sends through its HTTPS API', async () => {
  const f = fakeFetch(201, { messageId: '<abc@smtp-relay.brevo.com>' });
  const mailer = createMailer({ env: 'production', brevoApiKey: 'xkeysib-test', resendApiKey: 're_test', from: 'Axiom <yo@gmail.com>', fetchImpl: f.impl });
  assert.equal(mailer.name, 'brevo'); // gana a Resend si ambas existen
  const { text, html } = renderOtpEmail({ otp: '482913', type: 'sign-in' });
  await mailer.send({ to: 'ana@ejemplo.com', subject: 'Tu código', text, html, type: 'sign-in', otp: '482913' });
  const { url, init } = f.calls[0];
  assert.equal(url, 'https://api.brevo.com/v3/smtp/email');
  assert.equal(init.headers['api-key'], 'xkeysib-test');
  const body = JSON.parse(init.body);
  assert.deepEqual(body.sender, { name: 'Axiom', email: 'yo@gmail.com' });
  assert.deepEqual(body.to, [{ email: 'ana@ejemplo.com' }]);
  assert.match(body.textContent, /482913/);
  assert.ok(!('otp' in body) && !('type' in body));
});

test('a Brevo error (for example an unverified sender) rejects with its code and message', async () => {
  const f = fakeFetch(400, { code: 'invalid_parameter', message: 'Sender is not valid' });
  const mailer = createMailer({ env: 'production', brevoApiKey: 'k', fetchImpl: f.impl });
  await assert.rejects(mailer.send({ to: 'a@b.co', subject: 's', text: 't', html: 'h' }), /Brevo error 400: invalid_parameter: Sender is not valid/);
});

test('MAIL_PROVIDER forces a provider; a provider without its key falls back to the console', () => {
  assert.equal(createMailer({ env: 'production', brevoApiKey: 'k', resendApiKey: 'r', provider: 'resend' }).name, 'resend');
  assert.equal(createMailer({ env: 'production', resendApiKey: 'r' }).name, 'resend');
  assert.equal(createMailer({ env: 'production', provider: 'brevo' }).name, 'console');
});

test('parseFrom understands "Name <email>", quoted names and bare addresses', () => {
  assert.deepEqual(parseFrom('Axiom <yo@gmail.com>'), { name: 'Axiom', email: 'yo@gmail.com' });
  assert.deepEqual(parseFrom('"Axiom Market" <yo@gmail.com>'), { name: 'Axiom Market', email: 'yo@gmail.com' });
  assert.deepEqual(parseFrom('yo@gmail.com'), { email: 'yo@gmail.com' });
});
