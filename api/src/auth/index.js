import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer, emailOTP } from 'better-auth/plugins';
import { db } from '../db/index.js';
import * as schema from '../db/schema.js';
import { config } from '../config/index.js';
import { sendOtpEmail } from '../mail/index.js';

export const auth = betterAuth({
  basePath: '/api/v1/auth',
  baseURL: config.authUrl,
  secret: config.authSecret,
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  advanced: {
    database: { generateId: 'serial' }, // ids numéricos generados por la base de datos
    // Detrás de un proxy, Better Auth debe leer la IP real (rate limit y sesiones).
    ...(config.trustProxy ? { ipAddress: { ipAddressHeaders: ['x-forwarded-for'] } } : {}),
  },
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      role: { type: 'string', required: true, defaultValue: 'buyer', input: false },
      phone: { type: 'string', required: false, input: false },
    },
  },
  plugins: [
    bearer(),
    emailOTP({
      otpLength: 6,
      expiresIn: 600,
      allowedAttempts: 3,
      storeOTP: 'hashed',
      disableSignUp: true, // las cuentas solo se crean por /auth/buyer/sign-up o /auth/seller/sign-up
      sendVerificationOnSignUp: true,
      sendVerificationOTP: async ({ email, otp, type }) => {
        // Sin await: evita diferencias de tiempo que revelen si el correo existe.
        void sendOtpEmail({ email, otp, type }).catch((err) => console.error('[mail] send failed', err));
      },
    }),
  ],
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      '/email-otp/send-verification-otp': { window: 60, max: 3 },
      '/email-otp/verify-email': { window: 60, max: 5 },
      '/email-otp/request-password-reset': { window: 60, max: 3 },
      '/email-otp/reset-password': { window: 60, max: 5 },
    },
  },
});
