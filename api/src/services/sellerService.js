import { and, asc, desc, eq, ilike, inArray, isNull, lt, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { user } from '../db/schema.js';
import { organization, store } from '../db/business.js';
import { userWallet } from '../db/wallets.js';
import { HttpError } from '../middlewares/errorHandler.js';
import { bad, integer } from './validation.js';
import { scoresFor } from './statsService.js';
import { validateOrganizationPatch, validateStorePatch } from './storeService.js';

// Drizzle envuelve el error de pg en `cause`.
const conflict = (error) => {
  const err = error.cause ?? error;
  if (err.code !== '23505') return error;
  if (err.constraint?.includes('tax_id')) return new HttpError(409, 'That tax id is already registered', 'TAX_ID_ALREADY_EXISTS');
  if (err.constraint?.includes('legal_id')) return new HttpError(409, 'That legal id is already registered', 'LEGAL_ID_ALREADY_EXISTS');
  if (err.constraint?.includes('store_organization_id')) {
    return new HttpError(409, 'The organization already has its store', 'STORE_LIMIT');
  }
  return error;
};

// Crea la organización del usuario, su primera sucursal y lo promueve a seller, todo en una transacción.
export async function createSellerOrganization(userId, orgInput, storeInput) {
  try {
    return await db.transaction(async (tx) => {
      const [org] = await tx.insert(organization).values({ userId, ...orgInput }).returning();
      const [branch] = await tx.insert(store).values({ organizationId: org.id, ...storeInput }).returning();
      await tx.update(user).set({ role: 'seller' }).where(eq(user.id, userId));
      return { organization: org, store: branch };
    });
  } catch (err) {
    throw conflict(err);
  }
}

// Estado del seller: organización y número de sucursales (para el login).
export async function sellerStatus(userId) {
  const [org] = await db.select({ id: organization.id }).from(organization).where(eq(organization.userId, Number(userId)));
  if (!org) return { organization: false, store: false };
  const [branch] = await db
    .select({ id: store.id })
    .from(store)
    .where(and(eq(store.organizationId, org.id), isNull(store.deletedAt)))
    .limit(1);
  return { organization: true, store: Boolean(branch) };
}

// Organización y sucursal (no cerrada) del seller; 403 si falta alguna.
export async function getSellerContext(userId) {
  const [org] = await db.select().from(organization).where(eq(organization.userId, Number(userId)));
  if (!org) throw new HttpError(403, 'A seller must have an organization', 'ORGANIZATION_REQUIRED');
  const [branch] = await db
    .select()
    .from(store)
    .where(and(eq(store.organizationId, org.id), isNull(store.deletedAt)));
  if (!branch) throw new HttpError(403, 'A seller must have a store', 'STORE_REQUIRED');
  return { organization: org, store: branch };
}

export async function updateOrganization(userId, body) {
  const { organization: org } = await getSellerContext(userId);
  const patch = validateOrganizationPatch(org, body);
  const [row] = await db.update(organization).set(patch).where(eq(organization.id, org.id)).returning();
  return row;
}

export async function updateStore(userId, body) {
  const { store: branch } = await getSellerContext(userId);
  const patch = validateStorePatch(branch, body);
  const [row] = await db.update(store).set(patch).where(eq(store.id, branch.id)).returning();
  return row;
}

// Cierra la sucursal sin borrar su historial.
export async function closeStore(userId) {
  const { store: branch } = await getSellerContext(userId);
  const [row] = await db
    .update(store)
    .set({ status: 'closed', deletedAt: new Date() })
    .where(eq(store.id, branch.id))
    .returning();
  return row;
}

// Vista pública de una sucursal.
export async function getPublicStore(id) {
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) throw new HttpError(404, 'Store not found', 'STORE_NOT_FOUND');
  const [row] = await db
    .select()
    .from(store)
    .where(and(eq(store.id, n), isNull(store.deletedAt)));
  if (!row) throw new HttpError(404, 'Store not found', 'STORE_NOT_FOUND');
  return row;
}

// Listado público de sucursales activas, de la más nueva a la más antigua (cursor = id).
// Wallets de Open Payments de cada tienda: las de su dueño, la principal primero. La tienda cobra en la principal;
// el frontend las usa para mostrar la divisa y convertir precios. La dirección de una wallet es pública por diseño.
const presentStoreWallet = (w) => ({ id: w.id, name: w.name, address: w.address, assetCode: w.assetCode, assetScale: w.assetScale, isPrimary: w.isPrimary });

export async function walletsByStore(storeRows) {
  const map = new Map(storeRows.map((s) => [s.id, []]));
  if (storeRows.length === 0) return map;
  const rows = await db
    .select({ storeId: store.id, wallet: userWallet })
    .from(store)
    .innerJoin(organization, eq(organization.id, store.organizationId))
    .innerJoin(userWallet, eq(userWallet.userId, organization.userId))
    .where(inArray(store.id, storeRows.map((s) => s.id)))
    .orderBy(desc(userWallet.isPrimary), asc(userWallet.id));
  for (const { storeId, wallet } of rows) map.get(storeId).push(presentStoreWallet(wallet));
  return map;
}

const STORE_SORTS = ['newest', 'score'];

export async function listPublicStores(query) {
  const limit = query.limit === undefined ? 20 : integer(query.limit, 'limit', 1, 50, 'INVALID_LIMIT');
  const sort = query.sort ?? 'newest';
  if (!STORE_SORTS.includes(sort)) throw bad(`sort must be one of ${STORE_SORTS.join(', ')}`, 'INVALID_SORT');
  const filters = [eq(store.status, 'active'), isNull(store.deletedAt)];
  const escape = (v) => `%${v.replace(/[\\%_]/g, '\\$&')}%`;
  if (query.city !== undefined) {
    const city = String(query.city).trim();
    if (city.length > 80) throw bad('city must be at most 80 characters', 'INVALID_QUERY');
    if (city) filters.push(ilike(store.city, escape(city)));
  }
  if (query.q !== undefined) {
    const q = String(query.q).trim();
    if (q.length > 80) throw bad('q must be at most 80 characters', 'INVALID_QUERY');
    if (q) filters.push(or(ilike(store.name, escape(q)), ilike(store.description, escape(q))));
  }

  // Por puntaje: se calcula el de todas las tiendas que cumplen el filtro y se pagina por (puntaje, id).
  if (sort === 'score') {
    let after = null;
    if (query.cursor !== undefined) {
      const m = /^(\d{1,3}):(\d{1,15})$/.exec(String(query.cursor));
      if (!m) throw bad('cursor is not valid', 'INVALID_CURSOR');
      after = { score: Number(m[1]), id: Number(m[2]) };
    }
    const rows = await db.select().from(store).where(and(...filters)).orderBy(desc(store.id));
    const scores = await scoresFor(rows);
    const ranked = rows
      .map((row) => ({ row, ...scores.get(row.id) }))
      .sort((a, b) => b.score - a.score || b.row.id - a.row.id)
      .filter((r) => !after || r.score < after.score || (r.score === after.score && r.row.id < after.id));
    const page = ranked.slice(0, limit);
    const wallets = await walletsByStore(page.map((r) => r.row));
    return {
      stores: page.map(({ row, score, stars, level }) => ({ ...presentPublicStore(row), wallets: wallets.get(row.id), score, stars, level })),
      nextCursor: ranked.length > limit ? `${page.at(-1).score}:${page.at(-1).row.id}` : null,
    };
  }

  if (query.cursor !== undefined) {
    const cursor = Number(query.cursor);
    if (!Number.isSafeInteger(cursor)) throw bad('cursor is not valid', 'INVALID_CURSOR');
    filters.push(lt(store.id, cursor));
  }
  const rows = await db.select().from(store).where(and(...filters)).orderBy(desc(store.id)).limit(limit + 1);
  const page = rows.slice(0, limit);
  const [scores, wallets] = await Promise.all([scoresFor(page), walletsByStore(page)]);
  return {
    stores: page.map((row) => ({ ...presentPublicStore(row), wallets: wallets.get(row.id), ...scores.get(row.id) })),
    nextCursor: rows.length > limit ? String(page.at(-1).id) : null,
  };
}

export const presentOrganization = (o) => ({
  id: o.id,
  legalName: o.legalName,
  tradeName: o.tradeName,
  taxId: o.taxId,
  legalId: o.legalId,
  country: o.country,
  legalAddress: o.legalAddress,
  phone: o.phone,
  createdAt: o.createdAt,
});

const imageUrl = (key) => (key ? `/uploads/${key}` : null);

export const presentPublicStore = (s) => ({
  id: s.id,
  name: s.name,
  description: s.description,
  city: s.city,
  address: s.address,
  latitude: s.latitude,
  longitude: s.longitude,
  currency: s.currency,
  bannerUrl: imageUrl(s.bannerPath),
  iconUrl: imageUrl(s.iconPath),
  status: s.status,
});

export const presentStore = (s) => ({
  id: s.id,
  organizationId: s.organizationId,
  name: s.name,
  description: s.description,
  address: s.address,
  city: s.city,
  phone: s.phone,
  latitude: s.latitude,
  longitude: s.longitude,
  legalId: s.legalId,
  currency: s.currency,
  bannerUrl: imageUrl(s.bannerPath),
  iconUrl: imageUrl(s.iconPath),
  status: s.status,
  createdAt: s.createdAt,
});
