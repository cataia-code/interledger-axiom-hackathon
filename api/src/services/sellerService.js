import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { user } from '../db/schema.js';
import { organization, store } from '../db/business.js';
import { HttpError } from '../middlewares/errorHandler.js';

// Drizzle envuelve el error de pg en `cause`.
const conflict = (error) => {
  const err = error.cause ?? error;
  if (err.code !== '23505') return error;
  if (err.constraint?.includes('tax_id')) return new HttpError(409, 'That tax id is already registered', 'TAX_ID_ALREADY_EXISTS');
  if (err.constraint?.includes('store_organization_name')) {
    return new HttpError(409, 'The organization already has a store with that name', 'STORE_NAME_ALREADY_EXISTS');
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

// Añade una sucursal a la organización del seller.
export async function addStore(userId, storeInput) {
  const [org] = await db.select().from(organization).where(eq(organization.userId, userId));
  if (!org) throw new HttpError(403, 'A seller must have an organization', 'ORGANIZATION_REQUIRED');
  try {
    const [branch] = await db.insert(store).values({ organizationId: org.id, ...storeInput }).returning();
    return branch;
  } catch (err) {
    throw conflict(err);
  }
}

// Estado del seller: organización y número de sucursales (para el login).
export async function sellerStatus(userId) {
  const [org] = await db.select({ id: organization.id }).from(organization).where(eq(organization.userId, userId));
  if (!org) return { organization: false, store: false };
  const [branch] = await db.select({ id: store.id }).from(store).where(eq(store.organizationId, org.id)).limit(1);
  return { organization: true, store: Boolean(branch) };
}

export const presentOrganization = (o) => ({
  id: o.id,
  legalName: o.legalName,
  tradeName: o.tradeName,
  taxId: o.taxId,
  country: o.country,
  legalAddress: o.legalAddress,
  phone: o.phone,
  createdAt: o.createdAt,
});

export const presentStore = (s) => ({
  id: s.id,
  organizationId: s.organizationId,
  name: s.name,
  description: s.description,
  address: s.address,
  city: s.city,
  phone: s.phone,
  createdAt: s.createdAt,
});
