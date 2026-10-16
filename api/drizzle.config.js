import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: ['./src/db/schema.js', './src/db/business.js'],
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL },
});
