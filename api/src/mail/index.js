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
      if (env === 'production') console.log(`[mail] (not delivered, RESEND_API_KEY is not set) to=${message.to} subject="${message.subject}"`);
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

export function createMailer({ env = config.env, apiKey = config.resendApiKey, from = config.mailFrom, client } = {}) {
  return env === 'production' && apiKey ? createResendTransport({ apiKey, from, client }) : createConsoleTransport({ env });
}

export const mailer = createMailer();
if (config.env === 'production' && mailer.name !== 'resend') {
  console.warn('[mail] RESEND_API_KEY is not set: emails (including login and verification codes) will NOT be delivered');
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
