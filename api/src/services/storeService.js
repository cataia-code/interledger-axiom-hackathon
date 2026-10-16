import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { user } from '../db/schema.js';
import { store } from '../db/stores.js';
import { HttpError } from '../middlewares/errorHandler.js';

const alreadyExists = () => new HttpError(409, 'The user already has a store', 'STORE_ALREADY_EXISTS');

// Crea la tienda del usuario y lo promueve a seller en una sola transacción.
export async function createStore(userId, { name, description }) {
  try {
    return await db.transaction(async (tx) => {
      const [existing] = await tx.select({ id: store.id }).from(store).where(eq(store.userId, userId));
      if (existing) throw alreadyExists();

      const [created] = await tx.insert(store).values({ userId, name, description }).returning();
      const [updated] = await tx.update(user).set({ role: 'seller' }).where(eq(user.id, userId)).returning();
      return { store: created, role: updated.role };
    });
  } catch (err) {
    if (err.code === '23505') throw alreadyExists(); // carrera: otra petición creó la tienda antes
    throw err;
  }
}
