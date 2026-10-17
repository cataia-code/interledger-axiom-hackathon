import { Resend } from 'resend';
import { config } from '../config/index.js';

// Mensajes enviados por el transport de consola; los tests los leen desde aquí.
export const outbox = [];

// Consola (desarrollo y tests). En producción no se imprime el cuerpo: contiene códigos de acceso.
export function createConsoleTransport({ env }) {
  return {
    name: 'console',
    async send(message) {
      outbox.push(message);
      if (outbox.length > 100) outbox.shift();
      if (env === 'production') console.log(`[mail] (not delivered: no mail provider configured) to=${message.to} subject="${message.subject}"`);
      else if (env !== 'test') console.log(`[mail] to=${message.to} subject="${message.subject}"\n${message.text}`);
    },
  };
}

// Resend: https://resend.com/docs/send-with-nodejs. `client` permite inyectar uno falso en las pruebas.
export function createResendTransport({ apiKey, from, client = new Resend(apiKey) }) {
  return {
    name: 'resend',
    async send({ to, subject, text, html }) {
      const { data, error } = await client.emails.send({ from, to, subject, text, html });
      if (error) throw new Error(`Resend error: ${error.name ?? 'unknown'}: ${error.message}`);
      return data;
    },
  };
}

// "Nombre <correo@dominio>" o solo "correo@dominio" -> { name, email }.
export function parseFrom(from) {
  const m = /^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/.exec(from);
  return m ? { name: m[1]?.trim() || undefined, email: m[2].trim() } : { email: from.trim() };
}

// Brevo (plan gratuito: unos 300 correos al día) por su API HTTPS. No exige dominio propio: basta verificar
// el correo remitente en Brevo. Se usa HTTPS y no SMTP porque muchos hosts bloquean el SMTP saliente.
export function createBrevoTransport({ apiKey, from, fetchImpl = fetch }) {
  const sender = parseFrom(from);
  return {
    name: 'brevo',
    async send({ to, subject, text, html }) {
      const res = await fetchImpl('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ sender, to: [{ email: to }], subject, textContent: text, htmlContent: html }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`Brevo error ${res.status}: ${body.code ?? 'unknown'}: ${body.message ?? 'request failed'}`);
      return body;
    },
  };
}

// Mailjet (plan gratuito: 200 correos al día, 6 000 al mes) por su API HTTPS v3.1. Tampoco exige dominio propio:
// basta validar el correo remitente (Account → Sender addresses). Autenticación básica con clave pública y secreta.
export function createMailjetTransport({ apiKey, secretKey, from, fetchImpl = fetch }) {
  const sender = parseFrom(from);
  const auth = `Basic ${Buffer.from(`${apiKey}:${secretKey}`).toString('base64')}`;
  return {
    name: 'mailjet',
    async send({ to, subject, text, html }) {
      const res = await fetchImpl('https://api.mailjet.com/v3.1/send', {
        method: 'POST',
        headers: { authorization: auth, 'content-type': 'application/json' },
        body: JSON.stringify({
          Messages: [{ From: { Email: sender.email, ...(sender.name && { Name: sender.name }) }, To: [{ Email: to }], Subject: subject, TextPart: text, HTMLPart: html }],
        }),
      });
      const body = await res.json().catch(() => ({}));
      const failed = body.Messages?.find((m) => m.Status && m.Status !== 'success');
      if (!res.ok || failed) {
        const detail = failed?.Errors?.[0] ?? {};
        throw new Error(`Mailjet error ${res.status}: ${detail.ErrorCode ?? body.ErrorIdentifier ?? 'unknown'}: ${detail.ErrorMessage ?? body.ErrorMessage ?? 'request failed'}`);
      }
      return body;
    },
  };
}

// Elige el transport: MAIL_PROVIDER manda; si no, el primero con credenciales: Brevo, Mailjet, Resend; si no, consola.
export function createMailer({
  env = config.env,
  resendApiKey = config.resendApiKey,
  brevoApiKey = config.brevoApiKey,
  mailjetApiKey = config.mailjetApiKey,
  mailjetSecretKey = config.mailjetSecretKey,
  provider = config.mailProvider,
  from = config.mailFrom,
  client,
  fetchImpl,
} = {}) {
  if (env !== 'production') return createConsoleTransport({ env });
  const hasMailjet = Boolean(mailjetApiKey && mailjetSecretKey);
  const choice = provider || (brevoApiKey ? 'brevo' : hasMailjet ? 'mailjet' : resendApiKey ? 'resend' : 'console');
  if (choice === 'brevo' && brevoApiKey) return createBrevoTransport({ apiKey: brevoApiKey, from, fetchImpl });
  if (choice === 'mailjet' && hasMailjet) return createMailjetTransport({ apiKey: mailjetApiKey, secretKey: mailjetSecretKey, from, fetchImpl });
  if (choice === 'resend' && resendApiKey) return createResendTransport({ apiKey: resendApiKey, from, client });
  return createConsoleTransport({ env });
}

export const mailer = createMailer();
if (config.env === 'production' && mailer.name === 'console') {
  console.warn('[mail] no mail provider configured (set BREVO_API_KEY, MAILJET_API_KEY + MAILJET_SECRET_KEY, or RESEND_API_KEY): emails, including login and verification codes, will NOT be delivered');
} else if (config.env === 'production') {
  console.log(`[mail] sending through ${mailer.name}`);
}

const subjects = {
  'sign-in': 'Tu código para iniciar sesión',
  'email-verification': 'Verifica tu correo',
  'forget-password': 'Código para restablecer tu contraseña',
};
const intro = {
  'sign-in': 'Usa este código para iniciar sesión en Axiom.',
  'email-verification': 'Usa este código para verificar tu correo en Axiom.',
  'forget-password': 'Usa este código para restablecer tu contraseña de Axiom.',
};

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function renderOtpEmail({ otp, type }) {
  const lead = intro[type] ?? 'Tu código de verificación de Axiom.';
  const text = `${lead}\n\nTu código es ${otp}. Caduca en 10 minutos.\n\nSi no lo pediste, ignora este correo.`;
  const html = `<!doctype html><html lang="es"><body style="margin:0;padding:24px;background:#f4f7f3;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#12201a">
<table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #d6dfd8;border-radius:12px"><tr><td style="padding:28px">
<p style="margin:0 0 4px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#0b6b5a">Axiom Marketplace</p>
<p style="margin:0 0 20px;font-size:16px;line-height:1.5">${escapeHtml(lead)}</p>
<p style="margin:0 0 20px;font:700 32px/1 ui-monospace,Menlo,monospace;letter-spacing:.3em;color:#12201a">${escapeHtml(otp)}</p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#52625a">Caduca en 10 minutos. Si no lo pediste, ignora este correo.</p>
</td></tr></table></body></html>`;
  return { text, html };
}

export function sendOtpEmail({ email, otp, type }) {
  const { text, html } = renderOtpEmail({ otp, type });
  return mailer.send({ to: email, subject: subjects[type] ?? 'Tu código de verificación', text, html, type, otp });
}
