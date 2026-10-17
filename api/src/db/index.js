import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { config } from '../config/index.js';
import * as authSchema from './schema.js';
import * as businessSchema from './business.js';
import * as catalogSchema from './catalog.js';
import * as inventorySchema from './inventory.js';
import * as ordersSchema from './orders.js';
import * as paymentsSchema from './payments.js';
import * as couponsSchema from './coupons.js';

const schema = { ...authSchema, ...businessSchema, ...catalogSchema, ...inventorySchema, ...ordersSchema, ...paymentsSchema, ...couponsSchema };

export const pool = new pg.Pool({ connectionString: config.databaseUrl });

// Sin este manejador, una conexión inactiva cortada por Postgres (reinicio, failover, red) tumbaría el proceso.
export function onPoolError(err) {
  console.error('[db] idle client error (the pool will open a new connection):', err.message);
}
pool.on('error', onPoolError);
export const db = drizzle(pool, { schema });
