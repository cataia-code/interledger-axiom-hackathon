import 'dotenv/config';
import os from 'node:os';
import path from 'node:path';

const env = process.env.NODE_ENV ?? 'development';

// CORS_ORIGIN: uno o varios orígenes separados por comas. En producción es obligatorio y no puede ser "*".
export function parseCorsOrigin(value, nodeEnv = env) {
  if (!value || !value.trim()) {
    if (nodeEnv === 'production') throw new Error('CORS_ORIGIN is required in production (comma-separated list of allowed origins)');
    return '*';
  }
  const list = value.split(',').map((o) => o.trim()).filter(Boolean);
  if (nodeEnv === 'production' && list.includes('*')) throw new Error('CORS_ORIGIN cannot be "*" in production; list the allowed origins');
  return list.length === 1 ? list[0] : list;
}

// TRUST_PROXY: número de proxies delante de la API (p. ej. 1), o "true". Vacío = sin proxy.
export function parseTrustProxy(value) {
  if (value === undefined || value === '') return false;
  if (value === 'true') return true;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new Error('TRUST_PROXY must be a non-negative integer or "true"');
  return n;
}

export const config = {
  env,
  port: Number(process.env.PORT) || 3000,
  corsOrigin: parseCorsOrigin(process.env.CORS_ORIGIN),
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://axiom:axiom@localhost:5432/axiom',
  authSecret: process.env.BETTER_AUTH_SECRET,
  resendApiKey: process.env.RESEND_API_KEY,
  brevoApiKey: process.env.BREVO_API_KEY,
  mailjetApiKey: process.env.MAILJET_API_KEY,
  mailjetSecretKey: process.env.MAILJET_SECRET_KEY,
  mailProvider: process.env.MAIL_PROVIDER, // brevo | mailjet | resend; vacío = automático
  mailFrom: process.env.MAIL_FROM ?? 'Axiom <onboarding@resend.dev>',
  roleAuthRateLimitMax: process.env.NODE_ENV === 'test' ? 1000 : 5,
  uploadDir: process.env.UPLOAD_DIR ?? (process.env.NODE_ENV === 'test' ? path.join(os.tmpdir(), 'axiom-uploads-test') : path.resolve('uploads')),
  reservationTtlMinutes: Number(process.env.RESERVATION_TTL_MINUTES) || 15,
  commissionRate: Number(process.env.COMMISSION_RATE ?? 0.001), // 0.1 %
  paymentProvider: process.env.PAYMENT_PROVIDER ?? 'placeholder', // placeholder | openpayments
  // Identidad de la app ante Open Payments (no es la wallet de un usuario). La llave puede ir como PEM, en base64 o como ruta.
  opClientWalletAddress: process.env.OP_CLIENT_WALLET_ADDRESS,
  opKeyId: process.env.OP_KEY_ID,
  opPrivateKey: process.env.OP_PRIVATE_KEY,
  opPrivateKeyPath: process.env.OP_PRIVATE_KEY_PATH,
  publicApiUrl: (process.env.PUBLIC_API_URL ?? process.env.BETTER_AUTH_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  frontendUrl: process.env.FRONTEND_URL?.replace(/\/$/, ''), // al volver de la wallet se redirige aquí; vacío = responde JSON
  paymentWebhookSecret: process.env.PAYMENT_WEBHOOK_SECRET ?? (process.env.NODE_ENV === 'production' ? undefined : 'dev-placeholder-secret'),
  authUrl: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
};
