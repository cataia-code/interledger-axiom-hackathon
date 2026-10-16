import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './index.js';

// Aplica las migraciones pendientes de ./drizzle (se ejecuta antes de arrancar en el despliegue).
try {
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('[db] migrations applied');
} catch (err) {
  console.error('[db] migration failed', err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
