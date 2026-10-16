import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { config } from '../config/index.js';
import * as authSchema from './schema.js';
import * as businessSchema from './business.js';

const schema = { ...authSchema, ...businessSchema };

export const pool = new pg.Pool({ connectionString: config.databaseUrl });
export const db = drizzle(pool, { schema });
