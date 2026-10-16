import { and, desc, eq, gt, inArray, lt, sql } from 'drizzle-orm';
import { config } from '../config/index.js';
import { db } from '../db/index.js';
import { item } from '../db/catalog.js';
import { stockMovement, stockReservation } from '../db/inventory.js';
import { HttpError } from '../middlewares/errorHandler.js';
import { bad, integer, object, optional } from './validation.js';

export const insufficient = (itemId) =>
  new HttpError(409, `Not enough stock for item ${itemId}`, 'INSUFFICIENT_STOCK');

// Bloquea la fila del ítem y devuelve su stock actual. Toda escritura de stock pasa por aquí.
async function lockItem(tx, itemId) {
  const res = await tx.execute(sql`select id, current_stock from item where id = ${itemId} for update`);
  const row = res.rows[0];
  if (!row) throw new HttpError(404, 'Item not found', 'ITEM_NOT_FOUND');
  return Number(row.current_stock);
}

// Reservas activas y no vencidas. Las fechas pasan por los operadores de drizzle para serializarse igual que al insertar.
const activeReservations = (itemIds, now = new Date()) =>
  and(eq(stockReservation.status, 'active'), gt(stockReservation.expiresAt, now), inArray(stockReservation.itemId, itemIds));

export async function reservedByItem(itemIds, executor = db) {
  const map = new Map(itemIds.map((id) => [id, 0]));
  if (itemIds.length === 0) return map;
  const rows = await executor
    .select({ itemId: stockReservation.itemId, total: sql`coalesce(sum(${stockReservation.quantity}), 0)::int` })
    .from(stockReservation)
    .where(activeReservations(itemIds))
    .groupBy(stockReservation.itemId);
  for (const r of rows) map.set(r.itemId, Number(r.total));
  return map;
}

// Inserta un movimiento y actualiza item.current_stock en la misma transacción.
// Devuelve el movimiento. Nunca deja el stock negativo (409 INSUFFICIENT_STOCK).
export async function applyStockMovement(tx, { itemId, type, delta, reason = null, orderId = null, createdBy = null }) {
  if (!Number.isSafeInteger(delta) || delta === 0) throw new Error('stock delta must be a non-zero integer');
  const current = await lockItem(tx, itemId);
  const next = current + delta;
  if (next < 0) throw insufficient(itemId);
  await tx.update(item).set({ currentStock: next }).where(eq(item.id, itemId));
  const [movement] = await tx
    .insert(stockMovement)
    .values({ itemId, type, quantityDelta: delta, stockAfter: next, reason, orderId, createdBy })
    .returning();
  return movement;
}

// Reserva stock de varias líneas a la vez (todo o nada). Se ordena por ítem para evitar interbloqueos.
export async function reserveStock(tx, { orderId, lines, ttlMinutes = config.reservationTtlMinutes }) {
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
  const sorted = [...lines].sort((a, b) => a.itemId - b.itemId);
  const created = [];
  for (const line of sorted) {
    const current = await lockItem(tx, line.itemId);
    const reserved = (await reservedByItem([line.itemId], tx)).get(line.itemId);
    if (line.quantity > current - reserved) throw insufficient(line.itemId);
    const [row] = await tx.insert(stockReservation).values({ itemId: line.itemId, orderId, quantity: line.quantity, expiresAt }).returning();
    created.push(row);
  }
  return created;
}

// Pago confirmado: cada reserva activa se convierte en un movimiento de venta.
// Si la reserva ya venció, igualmente se intenta descontar (el pago es un hecho); falla si no queda stock.
export async function confirmReservations(tx, orderId) {
  const rows = await tx
    .select()
    .from(stockReservation)
    .where(and(eq(stockReservation.orderId, orderId), eq(stockReservation.status, 'active')))
    .orderBy(stockReservation.itemId);
  for (const r of rows) {
    await applyStockMovement(tx, { itemId: r.itemId, type: 'sale', delta: -r.quantity, orderId });
    await tx.update(stockReservation).set({ status: 'confirmed' }).where(eq(stockReservation.id, r.id));
  }
  return rows.length;
}

// Pedido cancelado o pago fallido: se liberan las reservas activas.
export async function releaseReservations(tx, orderId, status = 'released') {
  const rows = await tx
    .update(stockReservation)
    .set({ status })
    .where(and(eq(stockReservation.orderId, orderId), eq(stockReservation.status, 'active')))
    .returning();
  return rows.length;
}

// Pedido pagado que se cancela: el stock vendido vuelve.
export async function restockOrder(tx, orderId, reason) {
  const sold = await tx
    .select()
    .from(stockMovement)
    .where(and(eq(stockMovement.orderId, orderId), eq(stockMovement.type, 'sale')))
    .orderBy(stockMovement.itemId);
  for (const m of sold) {
    await applyStockMovement(tx, { itemId: m.itemId, type: 'cancel', delta: -m.quantityDelta, reason, orderId });
  }
}

// Marca como vencidas las reservas pasadas (la disponibilidad ya las ignora).
export async function expireReservations(now = new Date()) {
  const rows = await db
    .update(stockReservation)
    .set({ status: 'expired' })
    .where(and(eq(stockReservation.status, 'active'), lt(stockReservation.expiresAt, now)))
    .returning({ id: stockReservation.id, orderId: stockReservation.orderId });
  return rows;
}

// ---------- entradas del seller ----------
const SELLER_TYPES = ['restock', 'adjustment'];

export async function sellerMovement(itemRow, userId, body) {
  const b = object(body);
  if (!SELLER_TYPES.includes(b.type)) throw bad('type must be restock or adjustment', 'INVALID_MOVEMENT_TYPE');
  let delta;
  let reason = optional(b.reason, 'reason', 200, 'INVALID_REASON');
  if (b.type === 'restock') {
    delta = integer(b.quantity, 'quantity', 1, 1_000_000, 'INVALID_QUANTITY');
  } else {
    delta = integer(b.delta, 'delta', -1_000_000, 1_000_000, 'INVALID_QUANTITY');
    if (delta === 0) throw bad('delta must not be zero', 'INVALID_QUANTITY');
    if (!reason) throw bad('An adjustment needs a reason', 'REASON_REQUIRED');
  }
  return db.transaction((tx) => applyStockMovement(tx, { itemId: itemRow.id, type: b.type, delta, reason, createdBy: Number(userId) }));
}

export const presentMovement = (m) => ({
  id: m.id,
  itemId: m.itemId,
  type: m.type,
  quantityDelta: m.quantityDelta,
  stockAfter: m.stockAfter,
  reason: m.reason,
  orderId: m.orderId,
  createdAt: m.createdAt,
});

export async function listMovements(itemId, query) {
  const limit = query.limit === undefined ? 20 : integer(query.limit, 'limit', 1, 100, 'INVALID_LIMIT');
  let cursor = null;
  if (query.cursor) {
    cursor = Number(query.cursor);
    if (!Number.isSafeInteger(cursor)) throw bad('cursor is not valid', 'INVALID_CURSOR');
  }
  const where = cursor ? and(eq(stockMovement.itemId, itemId), lt(stockMovement.id, cursor)) : eq(stockMovement.itemId, itemId);
  const rows = await db.select().from(stockMovement).where(where).orderBy(desc(stockMovement.id)).limit(limit + 1);
  const page = rows.slice(0, limit);
  return { movements: page.map(presentMovement), nextCursor: rows.length > limit ? String(page.at(-1).id) : null };
}

// Consulta de control: el stock guardado debe coincidir con la suma de los movimientos.
export async function stockSummary(itemRow) {
  const [sum] = await db
    .select({ total: sql`coalesce(sum(${stockMovement.quantityDelta}), 0)::int` })
    .from(stockMovement)
    .where(eq(stockMovement.itemId, itemRow.id));
  const reserved = (await reservedByItem([itemRow.id])).get(itemRow.id);
  return {
    itemId: itemRow.id,
    currentStock: itemRow.currentStock,
    reserved,
    available: itemRow.currentStock - reserved,
    movementsTotal: Number(sum.total),
    consistent: Number(sum.total) === itemRow.currentStock,
  };
}
