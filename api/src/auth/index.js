import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP } from 'better-auth/plugins';
import { db } from '../db/index.js';
import * as schema from '../db/schema.js';
import { config } from '../config/index.js';
import { sendOtpEmail } from '../mail/index.js';

export const auth = betterAuth({
  basePath: '/api/v1/auth',
  baseURL: config.authUrl,
  secret: config.authSecret,
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      role: { type: 'string', required: true, defaultValue: 'buyer', input: false },
    },
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 600,
      allowedAttempts: 3,
      storeOTP: 'hashed',
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
      '/sign-up/email': { window: 60, max: 5 },
      '/sign-in/email': { window: 60, max: 5 },
      '/sign-in/email-otp': { window: 60, max: 5 },
      '/email-otp/send-verification-otp': { window: 60, max: 3 },
      '/email-otp/verify-email': { window: 60, max: 5 },
    },
  },
});
