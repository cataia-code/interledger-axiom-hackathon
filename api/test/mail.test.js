import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMailer, renderOtpEmail, outbox } from '../src/mail/index.js';

const fakeClient = (result) => {
  const calls = [];
  return { calls, emails: { send: async (payload) => (calls.push(payload), result) } };
};

test('production with an API key sends through Resend with from, subject, text and html', async () => {
  const client = fakeClient({ data: { id: 'em_123' }, error: null });
  const mailer = createMailer({ env: 'production', apiKey: 're_test', from: 'Axiom <no-reply@axiom.example>', client });
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
  const mailer = createMailer({ env: 'production', apiKey: 're_test', client });
  await assert.rejects(mailer.send({ to: 'a@b.co', subject: 's', text: 't', html: 'h' }), /validation_error: The domain is not verified/);
});

test('without an API key (or outside production) the console transport is used and codes are not printed in production', async () => {
  assert.equal(createMailer({ env: 'production', apiKey: undefined }).name, 'console');
  assert.equal(createMailer({ env: 'development', apiKey: 're_test' }).name, 'console');
  const lines = [];
  const original = console.log;
  console.log = (...args) => lines.push(args.join(' '));
  try {
    await createMailer({ env: 'production', apiKey: undefined }).send({ to: 'a@b.co', subject: 'Código', text: 'Tu código es 999999', html: '<b>999999</b>' });
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
