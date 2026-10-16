import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'drizzle-orm';
import { db, pool } from '../src/db/index.js';

let reachable = true;
try {
  await db.execute(sql`select 1`);
} catch {
  reachable = false;
}

after(() => pool.end());

test('users table exists with role defaulting to buyer', { skip: !reachable && 'database not reachable (run `npm run db:up` and `npm run db:migrate`)' }, async () => {
  const { rows } = await db.execute(
    sql`select column_default, is_nullable from information_schema.columns where table_name = 'user' and column_name = 'role'`,
  );
  assert.equal(rows.length, 1);
  assert.match(rows[0].column_default, /buyer/);
  assert.equal(rows[0].is_nullable, 'NO');
});
