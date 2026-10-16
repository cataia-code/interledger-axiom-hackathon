import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { user } from '../db/schema.js';
import { HttpError } from '../middlewares/errorHandler.js';

// Editar el propio perfil: solo nombre y teléfono.
export async function updateProfile(userId, body) {
  const b = body && typeof body === 'object' ? body : {};
  const patch = {};
  if (b.name !== undefined) {
    const name = typeof b.name === 'string' ? b.name.trim() : '';
    if (name.length < 1 || name.length > 80) throw new HttpError(400, 'name must be between 1 and 80 characters', 'INVALID_NAME');
    patch.name = name;
  }
  if (b.phone !== undefined) {
    if (b.phone !== null && (typeof b.phone !== 'string' || b.phone.trim().length > 30)) {
      throw new HttpError(400, 'phone must be a string of at most 30 characters', 'INVALID_PHONE');
    }
    patch.phone = b.phone ? b.phone.trim() || null : null;
  }
  if (Object.keys(patch).length === 0) throw new HttpError(400, 'Nothing to update', 'EMPTY_UPDATE');
  const [row] = await db.update(user).set(patch).where(eq(user.id, Number(userId))).returning();
  return row;
}
