import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { user } from '../db/schema.js';
import { organization, store } from '../db/business.js';
import { HttpError } from '../middlewares/errorHandler.js';
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

export const presentPublicStore = (s) => ({
  id: s.id,
  name: s.name,
  description: s.description,
  city: s.city,
  address: s.address,
  latitude: s.latitude,
  longitude: s.longitude,
  currency: s.currency,
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
  status: s.status,
  createdAt: s.createdAt,
});
