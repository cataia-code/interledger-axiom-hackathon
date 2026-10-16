import { and, asc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { category, item } from '../db/catalog.js';
import { HttpError } from '../middlewares/errorHandler.js';
import { bad, object, parseId, required, str } from './validation.js';

const slugify = (text) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const presentCategory = (c) => ({ id: c.id, storeId: c.storeId, parentId: c.parentId, name: c.name, slug: c.slug });

const conflict = (error) => {
  const err = error.cause ?? error;
  return err.code === '23505' && err.constraint?.includes('category_store_slug')
    ? new HttpError(409, 'The store already has a category with that slug', 'CATEGORY_SLUG_EXISTS')
    : error;
};

export const listCategories = (storeId) =>
  db.select().from(category).where(eq(category.storeId, storeId)).orderBy(asc(category.name), asc(category.id));

export async function findCategory(storeId, id) {
  const [row] = await db.select().from(category).where(eq(category.id, id));
  if (!row) throw new HttpError(404, 'Category not found', 'CATEGORY_NOT_FOUND');
  if (row.storeId !== storeId) throw new HttpError(403, 'That category belongs to another store', 'FORBIDDEN');
  return row;
}

// El padre debe ser de la misma sucursal y no puede crear un ciclo.
async function checkParent(storeId, parentId, selfId) {
  if (parentId == null) return;
  let cursor = parentId;
  const seen = new Set();
  while (cursor != null) {
    if (cursor === selfId || seen.has(cursor)) throw bad('parentId would create a cycle', 'CATEGORY_CYCLE');
    seen.add(cursor);
    const [row] = await db.select().from(category).where(eq(category.id, cursor));
    if (!row || row.storeId !== storeId) throw bad('parentId must be a category of this store', 'INVALID_PARENT');
    cursor = row.parentId;
  }
}

function parseParent(value) {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1) throw bad('parentId must be a category id', 'INVALID_PARENT');
  return n;
}

export async function createCategory(storeId, body) {
  const b = object(body);
  const name = required(b.name, 'name', 2, 80, 'INVALID_NAME');
  const slug = b.slug !== undefined ? str(b.slug) : slugify(name);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 80) throw bad('slug must be lowercase letters, digits and dashes', 'INVALID_SLUG');
  const parentId = parseParent(b.parentId);
  await checkParent(storeId, parentId, null);
  try {
    const [row] = await db.insert(category).values({ storeId, name, slug, parentId }).returning();
    return row;
  } catch (err) {
    throw conflict(err);
  }
}

export async function updateCategory(storeId, idParam, body) {
  const id = parseId(idParam, 'Category not found', 'CATEGORY_NOT_FOUND');
  const current = await findCategory(storeId, id);
  const b = object(body);
  const patch = {};
  if (b.name !== undefined) patch.name = required(b.name, 'name', 2, 80, 'INVALID_NAME');
  if (b.slug !== undefined) {
    patch.slug = str(b.slug);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(patch.slug) || patch.slug.length > 80) throw bad('slug must be lowercase letters, digits and dashes', 'INVALID_SLUG');
  }
  if (b.parentId !== undefined) {
    patch.parentId = parseParent(b.parentId);
    await checkParent(storeId, patch.parentId, current.id);
  }
  if (Object.keys(patch).length === 0) throw bad('Nothing to update', 'EMPTY_UPDATE');
  try {
    const [row] = await db.update(category).set(patch).where(eq(category.id, id)).returning();
    return row;
  } catch (err) {
    throw conflict(err);
  }
}

// Los ítems quedan sin categoría y las subcategorías suben a la raíz.
export async function deleteCategory(storeId, idParam) {
  const id = parseId(idParam, 'Category not found', 'CATEGORY_NOT_FOUND');
  await findCategory(storeId, id);
  await db.transaction(async (tx) => {
    await tx.update(category).set({ parentId: null }).where(and(eq(category.storeId, storeId), eq(category.parentId, id)));
    await tx.update(item).set({ categoryId: null }).where(eq(item.categoryId, id));
    await tx.delete(category).where(eq(category.id, id));
  });
}
