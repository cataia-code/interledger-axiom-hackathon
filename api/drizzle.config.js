import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: ['./src/db/schema.js', './src/db/business.js', './src/db/catalog.js', './src/db/inventory.js', './src/db/orders.js', './src/db/payments.js', './src/db/wallets.js'],
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL },
});
