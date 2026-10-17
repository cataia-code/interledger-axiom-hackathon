import { and, asc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { userWallet } from '../db/wallets.js';
import { HttpError } from '../middlewares/errorHandler.js';
import { provider } from '../payments/index.js';
import { bad, object, optional, parseId } from './validation.js';

export const MAX_WALLETS = 10;

export const presentWallet = (w) => ({
  id: w.id,
  name: w.name,
  address: w.address,
  assetCode: w.assetCode,
  assetScale: w.assetScale,
  isPrimary: w.isPrimary,
  updatedAt: w.updatedAt,
});

// Acepta la URL de la wallet o su payment pointer ($host/ruta) y devuelve una URL https sin barra final.
export function normalizeAddress(value) {
  if (typeof value !== 'string') throw bad('address must be a wallet address URL', 'INVALID_WALLET_ADDRESS');
  let v = value.trim();
  if (v.startsWith('$')) v = `https://${v.slice(1)}`;
  let url;
  try {
    url = new URL(v);
  } catch {
    throw bad('address must be a wallet address URL', 'INVALID_WALLET_ADDRESS');
  }
  const local = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw bad('address must use https', 'INVALID_WALLET_ADDRESS');
  if (v.length > 300 || url.pathname === '/' || url.search || url.hash) throw bad('address must be a wallet address URL', 'INVALID_WALLET_ADDRESS');
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

const parseName = (value) => optional(value, 'name', 60, 'INVALID_WALLET_NAME');
const notFound = () => new HttpError(404, 'Wallet not found', 'WALLET_NOT_FOUND');
const uniqueViolation = (error) => (error.cause ?? error).code === '23505';

const mine = (userId) => db.select().from(userWallet).where(eq(userWallet.userId, Number(userId))).orderBy(asc(userWallet.id));

export async function listWallets(userId) {
  return (await mine(userId)).map(presentWallet);
}

async function ownWallet(userId, idParam) {
  const id = parseId(idParam, 'Wallet not found', 'WALLET_NOT_FOUND');
  const [w] = await db.select().from(userWallet).where(and(eq(userWallet.id, id), eq(userWallet.userId, Number(userId))));
  if (!w) throw notFound();
  return w;
}

// Vincula otra wallet. Con Open Payments se consulta para guardar su moneda y escala. La primera queda como principal.
export async function addWallet(userId, body) {
  const b = object(body);
  const address = normalizeAddress(b.address);
  const name = parseName(b.name);
  const uid = Number(userId);
  if ((await mine(uid)).length >= MAX_WALLETS) throw new HttpError(409, `You can link up to ${MAX_WALLETS} wallets`, 'WALLET_LIMIT');
  let asset = { address, assetCode: 'USD', assetScale: 2 };
  if (provider.resolveWallet) {
    const w = await provider.resolveWallet(address);
    asset = { address: w.id, assetCode: w.assetCode, assetScale: w.assetScale };
  }
  try {
    return presentWallet(
      await db.transaction(async (tx) => {
        const existing = await tx.select({ id: userWallet.id }).from(userWallet).where(eq(userWallet.userId, uid));
        const makePrimary = existing.length === 0 || b.primary === true;
        if (makePrimary) await tx.update(userWallet).set({ isPrimary: false }).where(eq(userWallet.userId, uid));
        const [row] = await tx.insert(userWallet).values({ userId: uid, name, ...asset, isPrimary: makePrimary }).returning();
        return row;
      }),
    );
  } catch (err) {
    if (uniqueViolation(err)) throw new HttpError(409, 'That wallet is already linked', 'WALLET_ALREADY_LINKED');
    throw err;
  }
}

// Cambia el nombre y/o la hace principal. La wallet no se vuelve a consultar.
export async function updateWallet(userId, idParam, body) {
  const b = object(body);
  const w = await ownWallet(userId, idParam);
  if (b.name === undefined && b.primary === undefined) throw bad('Send name and/or primary', 'EMPTY_UPDATE');
  if (b.primary !== undefined && b.primary !== true) {
    throw bad('primary can only be set to true; make another wallet primary instead', 'INVALID_PRIMARY');
  }
  const patch = {};
  if (b.name !== undefined) patch.name = parseName(b.name);
  const row = await db.transaction(async (tx) => {
    if (b.primary === true) {
      await tx.update(userWallet).set({ isPrimary: false }).where(eq(userWallet.userId, w.userId));
      patch.isPrimary = true;
    }
    const [updated] = await tx.update(userWallet).set(patch).where(eq(userWallet.id, w.id)).returning();
    return updated;
  });
  return presentWallet(row);
}

// Al quitar la principal, la wallet más antigua que quede pasa a ser la principal.
export async function removeWallet(userId, idParam) {
  const w = await ownWallet(userId, idParam);
  await db.transaction(async (tx) => {
    await tx.delete(userWallet).where(eq(userWallet.id, w.id));
    if (w.isPrimary) {
      const [next] = await tx.select().from(userWallet).where(eq(userWallet.userId, w.userId)).orderBy(asc(userWallet.id)).limit(1);
      if (next) await tx.update(userWallet).set({ isPrimary: true }).where(eq(userWallet.id, next.id));
    }
  });
}
