import { and, desc, eq, ilike, isNull, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { store } from '../db/business.js';
import { bad, integer } from './validation.js';

// Puntaje aproximado de una tienda (0-100) a partir de lo que la API ya guarda: catálogo (30), ventas (40),
// confiabilidad (20) y actividad (10). No mide opinión de compradores: no hay reseñas.

// Escala logarítmica con tope: los primeros pedidos pesan más y, pasado el tope, ya no suben.
const logScale = (n, cap) => Math.min(1, Math.log(1 + n) / Math.log(1 + cap));
const ratio = (part, whole) => (whole > 0 ? part / whole : 0);
const round1 = (n) => Math.round(n * 10) / 10;

export function computeScore(m) {
  const finished = m.ordersCompleted + m.ordersCancelled + m.ordersRefunded;
  const catalog =
    (Math.min(m.activeItems, 20) / 20) * 15 + ratio(m.itemsWithImages, m.activeItems) * 8 + ratio(m.itemsInStock, m.activeItems) * 7;
  const sales = logScale(m.ordersCompleted, 50) * 25 + logScale(m.unitsSold, 200) * 8 + Math.min(1, m.uniqueBuyers / 10) * 7;
  // Suavizado: un solo pedido completado no da 100 % de confiabilidad.
  const reliability = ((m.ordersCompleted + 2) / (finished + 3)) * 20;
  const activity = Math.min(1, m.ordersLast30d / 10) * 6 + Math.min(1, m.stockMovementsLast30d / 20) * 2 + m.profilePoints;
  const total = catalog + sales + reliability + activity;
  return {
    score: Math.round(total),
    stars: round1(total / 20),
    breakdown: { catalog: round1(catalog), sales: round1(sales), reliability: round1(reliability), activity: round1(activity) },
    finishedOrders: finished,
  };
}

export const levelOf = (score, finished) =>
  finished < 3 ? 'new' : score < 40 ? 'bronze' : score < 65 ? 'silver' : score < 85 ? 'gold' : 'platinum';
export const confidenceOf = (finished) => (finished < 5 ? 'low' : finished < 20 ? 'medium' : 'high');

const idList = (ids) => sql.join(ids.map((id) => sql`${id}`), sql`, `);
const byStore = (res) => new Map(res.rows.map((r) => [Number(r.storeId), r]));

// Métricas de varias tiendas con unas pocas consultas agrupadas.
async function loadMetrics(stores) {
  const result = new Map();
  if (stores.length === 0) return result;
  const ids = idList(stores.map((s) => s.id));
  const [items, orders, repeat, units, movements, refunds, drafts] = (
    await Promise.all([
      db.execute(sql`
        select i.store_id as "storeId", count(*)::int as "activeItems",
          count(*) filter (where i.current_stock > 0)::int as "itemsInStock",
          count(*) filter (where exists (select 1 from item_image im where im.item_id = i.id))::int as "itemsWithImages",
          count(*) filter (where i.current_stock <= 5)::int as "lowStockItems"
        from item i where i.status = 'active' and i.deleted_at is null and i.store_id in (${ids}) group by i.store_id`),
      db.execute(sql`
        select o.store_id as "storeId", count(*)::int as total,
          count(*) filter (where o.status = 'completed')::int as completed,
          count(*) filter (where o.status = 'cancelled')::int as cancelled,
          count(*) filter (where o.status = 'refunded')::int as refunded,
          count(*) filter (where o.status = 'pending_payment')::int as pending_payment,
          count(*) filter (where o.status = 'paid')::int as paid,
          count(*) filter (where o.status = 'preparing')::int as preparing,
          count(*) filter (where o.created_at >= now() - interval '30 days')::int as "last30d",
          count(distinct o.buyer_id) filter (where o.status = 'completed')::int as "uniqueBuyers",
          coalesce(sum(o.total_amount) filter (where o.status = 'completed'), 0)::float8 as "completedAmount",
          coalesce(sum(o.total_amount) filter (where o.status = 'completed' and o.created_at >= now() - interval '30 days'), 0)::float8 as "last30dAmount"
        from "order" o where o.store_id in (${ids}) group by o.store_id`),
      db.execute(sql`
        select t.store_id as "storeId", count(*)::int as "repeatBuyers" from (
          select o.store_id, o.buyer_id from "order" o where o.status = 'completed' and o.store_id in (${ids})
          group by o.store_id, o.buyer_id having count(*) >= 2) t group by t.store_id`),
      db.execute(sql`
        select o.store_id as "storeId", coalesce(sum(oi.quantity), 0)::int as units
        from order_item oi join "order" o on o.id = oi.order_id
        where o.status = 'completed' and o.store_id in (${ids}) group by o.store_id`),
      db.execute(sql`
        select i.store_id as "storeId", count(*)::int as n
        from stock_movement m join item i on i.id = m.item_id
        where m.type in ('initial', 'restock', 'adjustment') and m.created_at >= now() - interval '30 days' and i.store_id in (${ids})
        group by i.store_id`),
      db.execute(sql`
        select o.store_id as "storeId", coalesce(sum(r.amount), 0)::float8 as refunded
        from refund r join payment p on p.id = r.payment_id join "order" o on o.id = p.order_id
        where r.status = 'succeeded' and o.store_id in (${ids}) group by o.store_id`),
      db.execute(sql`
        select i.store_id as "storeId", count(*)::int as n from item i
        where i.status = 'draft' and i.deleted_at is null and i.store_id in (${ids}) group by i.store_id`),
    ])
  ).map(byStore);

  const now = Date.now();
  for (const s of stores) {
    const i = items.get(s.id) ?? {};
    const o = orders.get(s.id) ?? {};
    const profilePoints = (s.description ? 0.5 : 0) + (s.bannerPath ? 1 : 0) + (s.iconPath ? 0.5 : 0);
    result.set(s.id, {
      activeItems: i.activeItems ?? 0,
      itemsInStock: i.itemsInStock ?? 0,
      itemsWithImages: i.itemsWithImages ?? 0,
      ordersCompleted: o.completed ?? 0,
      ordersCancelled: o.cancelled ?? 0,
      ordersRefunded: o.refunded ?? 0,
      unitsSold: units.get(s.id)?.units ?? 0,
      uniqueBuyers: o.uniqueBuyers ?? 0,
      repeatBuyers: repeat.get(s.id)?.repeatBuyers ?? 0,
      ordersLast30d: o.last30d ?? 0,
      stockMovementsLast30d: movements.get(s.id)?.n ?? 0,
      profilePoints,
      memberSinceDays: Math.max(0, Math.floor((now - new Date(s.createdAt).getTime()) / 86_400_000)),
      // Solo para el vendedor.
      private: {
        currency: s.currency,
        completedAmount: o.completedAmount ?? 0,
        last30dAmount: o.last30dAmount ?? 0,
        refundedAmount: refunds.get(s.id)?.refunded ?? 0,
        ordersByStatus: {
          pending_payment: o.pending_payment ?? 0,
          paid: o.paid ?? 0,
          preparing: o.preparing ?? 0,
          completed: o.completed ?? 0,
          cancelled: o.cancelled ?? 0,
          refunded: o.refunded ?? 0,
        },
        lowStockItems: i.lowStockItems ?? 0,
        itemsWithoutImages: (i.activeItems ?? 0) - (i.itemsWithImages ?? 0),
        draftItems: drafts.get(s.id)?.n ?? 0,
      },
    });
  }
  return result;
}

function summarize(m) {
  const s = computeScore(m);
  return { score: s.score, stars: s.stars, level: levelOf(s.score, s.finishedOrders), confidence: confidenceOf(s.finishedOrders), breakdown: s.breakdown, finished: s.finishedOrders };
}

function presentStats(storeRow, m) {
  const { score, stars, level, confidence, breakdown, finished } = summarize(m);
  return {
    storeId: storeRow.id,
    score,
    stars,
    level,
    confidence,
    breakdown,
    metrics: {
      activeItems: m.activeItems,
      itemsInStock: m.itemsInStock,
      itemsWithImages: m.itemsWithImages,
      ordersCompleted: m.ordersCompleted,
      ordersCancelled: m.ordersCancelled,
      ordersRefunded: m.ordersRefunded,
      completionRate: finished > 0 ? Math.round((m.ordersCompleted / finished) * 100) / 100 : null,
      unitsSold: m.unitsSold,
      uniqueBuyers: m.uniqueBuyers,
      repeatBuyers: m.repeatBuyers,
      ordersLast30d: m.ordersLast30d,
      memberSinceDays: m.memberSinceDays,
    },
    generatedAt: new Date().toISOString(),
  };
}

// Estadísticas públicas de una tienda (sin dinero).
export async function getStoreStats(storeRow) {
  const m = (await loadMetrics([storeRow])).get(storeRow.id);
  return presentStats(storeRow, m);
}

// Lo mismo más lo privado: ventas, pedidos por estado y alertas.
export async function getSellerStats(storeRow) {
  const m = (await loadMetrics([storeRow])).get(storeRow.id);
  const p = m.private;
  const tips = [];
  if (p.itemsWithoutImages > 0) tips.push(`Faltan fotos en ${p.itemsWithoutImages} ítems`);
  if (p.lowStockItems > 0) tips.push(`${p.lowStockItems} ítems con 5 unidades o menos`);
  if (m.activeItems === 0) tips.push('Publica al menos un ítem activo');
  if (!storeRow.bannerPath || !storeRow.iconPath) tips.push('Sube el banner y el icono de la tienda');
  return {
    ...presentStats(storeRow, m),
    sales: {
      currency: p.currency,
      completedAmount: p.completedAmount,
      last30dAmount: p.last30dAmount,
      averageOrderAmount: m.ordersCompleted > 0 ? Math.round(p.completedAmount / m.ordersCompleted) : 0,
      refundedAmount: p.refundedAmount,
    },
    ordersByStatus: p.ordersByStatus,
    alerts: { lowStockItems: p.lowStockItems, itemsWithoutImages: p.itemsWithoutImages, draftItems: p.draftItems },
    tips,
  };
}

// Puntaje de varias tiendas (para el listado y el ranking).
export async function scoresFor(storeRows) {
  const metrics = await loadMetrics(storeRows);
  return new Map(storeRows.map((s) => {
    const { score, stars, level } = summarize(metrics.get(s.id));
    return [s.id, { score, stars, level }];
  }));
}

const activeStores = (extra = []) => and(eq(store.status, 'active'), isNull(store.deletedAt), ...extra);

// Estadísticas generales del marketplace y ranking de tiendas.
export async function getGeneralStats(query) {
  const limit = query.limit === undefined ? 5 : integer(query.limit, 'limit', 1, 20, 'INVALID_LIMIT');
  const where = [];
  if (query.city !== undefined) {
    const city = String(query.city).trim();
    if (city.length > 80) throw bad('city must be at most 80 characters', 'INVALID_QUERY');
    if (city) where.push(ilike(store.city, `%${city.replace(/[\\%_]/g, '\\$&')}%`));
  }
  const [counts, orderCounts, users, ranked] = await Promise.all([
    db.execute(sql`
      select count(*) filter (where s.status = 'active')::int as active, count(*) filter (where s.status = 'paused')::int as paused,
        (select count(*)::int from item i join store st on st.id = i.store_id
          where i.status = 'active' and i.deleted_at is null and st.status = 'active' and st.deleted_at is null) as "activeItems"
      from store s where s.deleted_at is null`),
    db.execute(sql`
      select count(*)::int as total,
        count(*) filter (where created_at >= now() - interval '30 days')::int as "last30d",
        count(*) filter (where status = 'completed')::int as completed,
        count(*) filter (where status = 'cancelled')::int as cancelled,
        count(*) filter (where status = 'refunded')::int as refunded,
        count(*) filter (where status in ('pending_payment', 'paid', 'preparing'))::int as in_progress
      from "order"`),
    db.execute(sql`select count(*) filter (where role = 'buyer')::int as buyers, count(*) filter (where role = 'seller')::int as sellers from "user"`),
    db.select().from(store).where(activeStores(where)).orderBy(desc(store.id)),
  ]);
  const scores = await scoresFor(ranked);
  const topStores = ranked
    .map((s) => ({ id: s.id, name: s.name, city: s.city, iconUrl: s.iconPath ? `/uploads/${s.iconPath}` : null, ...scores.get(s.id) }))
    .sort((a, b) => b.score - a.score || b.id - a.id)
    .slice(0, limit);
  const c = counts.rows[0];
  const o = orderCounts.rows[0];
  return {
    stores: { active: c.active, paused: c.paused },
    items: { active: c.activeItems },
    orders: { total: o.total, last30d: o.last30d, byStatus: { completed: o.completed, cancelled: o.cancelled, refunded: o.refunded, in_progress: o.in_progress } },
    users: users.rows[0],
    topStores,
    generatedAt: new Date().toISOString(),
  };
}

// Ids de tiendas activas con filtros, para ordenar el listado por puntaje.
export async function rankedStoreRows(extraWhere) {
  return db.select().from(store).where(activeStores(extraWhere)).orderBy(desc(store.id));
}
