import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '../db/index.js';
import * as schema from '../db/schema.js';
import { config } from '../config/index.js';

export const auth = betterAuth({
  basePath: '/api/v1/auth',
  baseURL: config.authUrl,
  secret: config.authSecret,
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  emailAndPassword: { enabled: true },
  user: {
    additionalFields: {
      role: { type: 'string', required: true, defaultValue: 'buyer', input: false },
    },
  },
});
