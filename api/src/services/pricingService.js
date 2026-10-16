import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { itemDiscount } from '../db/catalog.js';

// Descuento vigente: activo, ya iniciado y no vencido.
export const isDiscountCurrent = (d, now = new Date()) =>
  d.active && d.startsAt <= now && (d.endsAt == null || d.endsAt > now);

// Monto que se descuenta de un precio unitario (unidades menores).
export function discountAmount(price, discount) {
  if (!discount) return 0;
  const raw = discount.type === 'percent' ? Math.floor((price * discount.value) / 10000) : discount.value;
  return Math.min(Math.max(raw, 0), price);
}

export const finalPrice = (price, discount) => price - discountAmount(price, discount);

// Descuentos vigentes de varios ítems: Map itemId -> descuento (uno por ítem).
export async function currentDiscounts(itemIds, now = new Date()) {
  const map = new Map();
  if (itemIds.length === 0) return map;
  const rows = await db
    .select()
    .from(itemDiscount)
    .where(and(inArray(itemDiscount.itemId, itemIds), eq(itemDiscount.active, true)));
  for (const d of rows) if (isDiscountCurrent(d, now)) map.set(d.itemId, d);
  return map;
}

// Precios de una línea (unidades menores). `discount` es el descuento vigente del ítem o undefined.
export function priceLine(price, discount, quantity) {
  const discountUnit = discountAmount(price, discount);
  const unit = price - discountUnit;
  return { originalUnit: price, discountUnit, unit, quantity, line: unit * quantity };
}

// Totales de un conjunto de líneas ya calculadas con priceLine.
export function totalsOf(lines) {
  const subtotal = lines.reduce((sum, l) => sum + l.originalUnit * l.quantity, 0);
  const discount = lines.reduce((sum, l) => sum + l.discountUnit * l.quantity, 0);
  return { subtotal, discount, total: subtotal - discount };
}

// Comisión del marketplace sobre el total, redondeada a la unidad menor.
export const commissionOf = (total, rate) => Math.round(total * rate);
