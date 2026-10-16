import 'dotenv/config';

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT) || 3000,
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://axiom:axiom@localhost:5432/axiom',
  authSecret: process.env.BETTER_AUTH_SECRET,
  resendApiKey: process.env.RESEND_API_KEY,
  mailFrom: process.env.MAIL_FROM ?? 'Axiom <onboarding@resend.dev>',
  roleAuthRateLimitMax: process.env.NODE_ENV === 'test' ? 1000 : 5,
  authUrl: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
};
