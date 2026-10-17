import { and, desc, eq, inArray, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { store } from '../db/business.js';
import { item } from '../db/catalog.js';
import { cart, order } from '../db/orders.js';
import { coupon, couponItem, couponRedemption, couponWallet } from '../db/coupons.js';
import { user } from '../db/schema.js';
import { HttpError } from '../middlewares/errorHandler.js';
import { bad, integer, object, optional, parseId, required, str } from './validation.js';
import { activeCart, priceCart, viewCart } from './cartService.js';
import { couponState, evaluateCoupon, loadCouponFacts } from './couponEngine.js';

export const COUPON_TYPES = ['percent', 'fixed'];
export const COUPON_AUDIENCES = ['assigned', 'public'];
export const COUPON_STATUSES = ['active', 'paused'];
const MAX_AMOUNT = 1_000_000_000_000;
const MAX_ASSIGN_EMAILS = 100;

const present = (c, extra = {}) => ({
  id: c.id,
  storeId: c.storeId,
  code: c.code,
  title: c.title,
  description: c.description,
  type: c.type,
  value: c.value,
  maxDiscountAmount: c.maxDiscountAmount,
  minSubtotalAmount: c.minSubtotalAmount,
  startsAt: c.startsAt,
  endsAt: c.endsAt,
  maxRedemptions: c.maxRedemptions,
  perUserLimit: c.perUserLimit,
  audience: c.audience,
  status: c.status,
  createdAt: c.createdAt,
  ...extra,
});

const notFound = () => new HttpError(404, 'Coupon not found', 'COUPON_NOT_FOUND');

function date(value, field, code) {
  const d = new Date(value);
  if (typeof value !== 'string' || Number.isNaN(d.getTime())) throw bad(`${field} must be an ISO date`, code);
  return d;
}

// ---------- vendedor ----------
function parseCode(value) {
  if (value == null || value === '') return null;
  const code = str(value).toUpperCase();
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) throw bad('code must be 3 to 30 letters, digits, - or _', 'INVALID_CODE');
  return code;
}

function parseCoupon(b, current = {}) {
  const merged = { ...current, ...b };
  const type = merged.type;
  if (!COUPON_TYPES.includes(type)) throw bad('type must be percent or fixed', 'INVALID_TYPE');
  // percent: puntos base (1000 = 10 %), máximo 90 %; fixed: unidades menores.
  const value = integer(merged.value, 'value', 1, type === 'percent' ? 9000 : MAX_AMOUNT, 'INVALID_VALUE');
  const maxDiscountAmount = merged.maxDiscountAmount == null ? null : integer(merged.maxDiscountAmount, 'maxDiscountAmount', 1, MAX_AMOUNT, 'INVALID_MAX_DISCOUNT');
  if (maxDiscountAmount != null && type !== 'percent') throw bad('maxDiscountAmount only applies to percent coupons', 'INVALID_MAX_DISCOUNT');
  const startsAt = merged.startsAt == null ? new Date() : merged.startsAt instanceof Date ? merged.startsAt : date(merged.startsAt, 'startsAt', 'INVALID_DATES');
  const endsAt = merged.endsAt == null ? null : merged.endsAt instanceof Date ? merged.endsAt : date(merged.endsAt, 'endsAt', 'INVALID_DATES');
  if (endsAt && endsAt <= startsAt) throw bad('endsAt must be after startsAt', 'INVALID_DATES');
  const audience = merged.audience ?? 'assigned';
  if (!COUPON_AUDIENCES.includes(audience)) throw bad('audience must be assigned or public', 'INVALID_AUDIENCE');
  return {
    code: parseCode(merged.code),
    title: required(merged.title, 'title', 2, 80, 'INVALID_TITLE'),
    description: optional(merged.description, 'description', 300, 'INVALID_DESCRIPTION'),
    type,
    value,
    maxDiscountAmount,
    minSubtotalAmount: merged.minSubtotalAmount == null ? 0 : integer(merged.minSubtotalAmount, 'minSubtotalAmount', 0, MAX_AMOUNT, 'INVALID_MIN_SUBTOTAL'),
    startsAt,
    endsAt,
    maxRedemptions: merged.maxRedemptions == null ? null : integer(merged.maxRedemptions, 'maxRedemptions', 1, 1_000_000, 'INVALID_MAX_REDEMPTIONS'),
    perUserLimit: merged.perUserLimit == null ? 1 : integer(merged.perUserLimit, 'perUserLimit', 1, 100, 'INVALID_PER_USER_LIMIT'),
    audience,
  };
}

async function validItemIds(storeId, value) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 200) throw bad('itemIds must be a list of up to 200 item ids', 'INVALID_ITEMS');
  const ids = [...new Set(value.map((v) => integer(v, 'itemIds', 1, Number.MAX_SAFE_INTEGER, 'INVALID_ITEMS')))];
  if (ids.length === 0) return [];
  const found = await db.select({ id: item.id }).from(item).where(and(inArray(item.id, ids), eq(item.storeId, storeId), isNull(item.deletedAt)));
  if (found.length !== ids.length) throw bad('itemIds must be items of your store', 'INVALID_ITEMS');
  return ids;
}

const uniqueCode = (error) => {
  const err = error.cause ?? error;
  return err.code === '23505' && err.constraint === 'coupon_store_code_unique'
    ? new HttpError(409, 'The store already has a coupon with that code', 'COUPON_CODE_EXISTS')
    : error;
};

async function ownCoupon(storeId, idParam) {
  const id = parseId(idParam, 'Coupon not found', 'COUPON_NOT_FOUND');
  const [row] = await db.select().from(coupon).where(and(eq(coupon.id, id), isNull(coupon.deletedAt)));
  if (!row) throw notFound();
  if (row.storeId !== storeId) throw new HttpError(403, 'That coupon belongs to another store', 'FORBIDDEN');
  return row;
}

async function sellerView(row) {
  const [items, stats] = await Promise.all([
    db.select({ itemId: couponItem.itemId }).from(couponItem).where(eq(couponItem.couponId, row.id)),
    db.execute(sql`
      select (select count(*)::int from coupon_redemption where coupon_id = ${row.id} and status = 'reserved') as redeemed,
             (select count(*)::int from coupon_wallet where coupon_id = ${row.id}) as "walletUsers"`),
  ]);
  return present(row, { itemIds: items.map((i) => Number(i.itemId)), redeemed: stats.rows[0].redeemed, walletUsers: stats.rows[0].walletUsers });
}

export async function createCoupon(storeId, body) {
  const b = object(body);
  const input = parseCoupon(b);
  const itemIds = await validItemIds(storeId, b.itemIds);
  try {
    const row = await db.transaction(async (tx) => {
      const [created] = await tx.insert(coupon).values({ storeId, ...input }).returning();
      if (itemIds.length > 0) await tx.insert(couponItem).values(itemIds.map((itemId) => ({ couponId: created.id, itemId })));
      return created;
    });
    return sellerView(row);
  } catch (err) {
    throw uniqueCode(err);
  }
}

export async function getSellerCoupon(storeId, idParam) {
  return sellerView(await ownCoupon(storeId, idParam));
}

export async function listSellerCoupons(storeId, query) {
  const limit = query.limit === undefined ? 20 : integer(query.limit, 'limit', 1, 50, 'INVALID_LIMIT');
  const where = [eq(coupon.storeId, storeId), isNull(coupon.deletedAt)];
  if (query.status !== undefined) {
    const now = new Date();
    if (query.status === 'active') where.push(eq(coupon.status, 'active'), or(isNull(coupon.endsAt), sql`${coupon.endsAt} > ${now}`));
    else if (query.status === 'paused') where.push(eq(coupon.status, 'paused'));
    else if (query.status === 'expired') where.push(isNotNull(coupon.endsAt), sql`${coupon.endsAt} <= ${now}`);
    else throw bad('status must be active, paused or expired', 'INVALID_STATUS');
  }
  if (query.cursor !== undefined) {
    const cursor = Number(query.cursor);
    if (!Number.isSafeInteger(cursor)) throw bad('cursor is not valid', 'INVALID_CURSOR');
    where.push(lt(coupon.id, cursor));
  }
  const rows = await db.select().from(coupon).where(and(...where)).orderBy(desc(coupon.id)).limit(limit + 1);
  const page = rows.slice(0, limit);
  return { coupons: await Promise.all(page.map(sellerView)), nextCursor: rows.length > limit ? String(page.at(-1).id) : null };
}

const CHANGEABLE_AFTER_USE = ['title', 'description', 'status', 'endsAt', 'maxRedemptions'];
const EDITABLE = ['code', 'title', 'description', 'type', 'value', 'maxDiscountAmount', 'minSubtotalAmount', 'startsAt', 'endsAt', 'maxRedemptions', 'perUserLimit', 'audience', 'status', 'itemIds'];

export async function updateCoupon(storeId, idParam, body) {
  const row = await ownCoupon(storeId, idParam);
  const b = object(body);
  const keys = EDITABLE.filter((k) => b[k] !== undefined);
  if (keys.length === 0) throw bad('Nothing to update', 'EMPTY_UPDATE');
  const [{ used }] = (await db.execute(sql`select count(*)::int as used from coupon_redemption where coupon_id = ${row.id}`)).rows.map((r) => ({ used: r.used }));
  if (used > 0) {
    const locked = keys.filter((k) => !CHANGEABLE_AFTER_USE.includes(k));
    if (locked.length > 0) throw new HttpError(409, `A coupon that was already used only allows changes to ${CHANGEABLE_AFTER_USE.join(', ')}`, 'COUPON_IN_USE');
  }
  const patch = {};
  if (b.status !== undefined) {
    if (!COUPON_STATUSES.includes(b.status)) throw bad('status must be active or paused', 'INVALID_STATUS');
    patch.status = b.status;
  }
  const parsed = parseCoupon(b, { ...row, itemIds: undefined });
  for (const k of keys) if (k !== 'status' && k !== 'itemIds') patch[k] = parsed[k];
  if (patch.maxRedemptions != null && patch.maxRedemptions < used) throw bad('maxRedemptions cannot be lower than the uses so far', 'INVALID_MAX_REDEMPTIONS');
  const itemIds = keys.includes('itemIds') ? await validItemIds(storeId, b.itemIds) : null;
  try {
    const updated = await db.transaction(async (tx) => {
      const [r] = Object.keys(patch).length > 0 ? await tx.update(coupon).set(patch).where(eq(coupon.id, row.id)).returning() : [row];
      if (itemIds) {
        await tx.delete(couponItem).where(eq(couponItem.couponId, row.id));
        if (itemIds.length > 0) await tx.insert(couponItem).values(itemIds.map((itemId) => ({ couponId: row.id, itemId })));
      }
      return r;
    });
    return sellerView(updated);
  } catch (err) {
    throw uniqueCode(err);
  }
}

export async function deleteCoupon(storeId, idParam) {
  const row = await ownCoupon(storeId, idParam);
  const [pending] = (await db.execute(sql`select count(*)::int as n from coupon_redemption where coupon_id = ${row.id} and status = 'reserved'`)).rows;
  if (pending.n > 0) throw new HttpError(409, 'The coupon has orders waiting for payment; pause it instead', 'COUPON_IN_USE');
  await db.update(coupon).set({ deletedAt: new Date(), code: null }).where(eq(coupon.id, row.id));
}

export async function assignCoupon(storeId, idParam, body) {
  const row = await ownCoupon(storeId, idParam);
  const emails = object(body).emails;
  if (!Array.isArray(emails) || emails.length === 0 || emails.length > MAX_ASSIGN_EMAILS) {
    throw bad(`emails must be a list of 1 to ${MAX_ASSIGN_EMAILS} addresses`, 'INVALID_EMAILS');
  }
  const wanted = [...new Set(emails.map((e) => (typeof e === 'string' ? e.trim().toLowerCase() : '')))].filter(Boolean);
  const users = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(and(eq(user.role, 'buyer'), inArray(sql`lower(${user.email})`, wanted)));
  const byEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));
  const have = new Set(
    (await db.select({ userId: couponWallet.userId }).from(couponWallet).where(and(eq(couponWallet.couponId, row.id), inArray(couponWallet.userId, [...byEmail.values(), -1])))).map((r) => r.userId),
  );
  const assigned = [];
  const alreadyHad = [];
  const notFoundEmails = [];
  for (const email of wanted) {
    const id = byEmail.get(email);
    if (id == null) notFoundEmails.push(email);
    else if (have.has(id)) alreadyHad.push(email);
    else {
      await db.insert(couponWallet).values({ couponId: row.id, userId: id, source: 'assigned' }).onConflictDoNothing();
      assigned.push(email);
    }
  }
  return { assigned, alreadyHad, notFound: notFoundEmails };
}

export async function listRedemptions(storeId, idParam, query) {
  const row = await ownCoupon(storeId, idParam);
  const limit = query.limit === undefined ? 20 : integer(query.limit, 'limit', 1, 50, 'INVALID_LIMIT');
  const where = [eq(couponRedemption.couponId, row.id)];
  if (query.cursor !== undefined) {
    const cursor = Number(query.cursor);
    if (!Number.isSafeInteger(cursor)) throw bad('cursor is not valid', 'INVALID_CURSOR');
    where.push(lt(couponRedemption.id, cursor));
  }
  const rows = await db
    .select({ r: couponRedemption, number: order.number })
    .from(couponRedemption)
    .innerJoin(order, eq(order.id, couponRedemption.orderId))
    .where(and(...where))
    .orderBy(desc(couponRedemption.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  return {
    redemptions: page.map(({ r, number }) => ({
      id: r.id, orderId: r.orderId, orderNumber: number, userId: r.userId, discountAmount: r.discountAmount, status: r.status, createdAt: r.createdAt, releasedAt: r.releasedAt,
    })),
    nextCursor: rows.length > limit ? String(page.at(-1).r.id) : null,
  };
}

// ---------- comprador ----------
const STATES = ['available', 'used', 'exhausted', 'expired', 'upcoming', 'paused'];

async function buyerViews(userId, rows) {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.c.id);
  const [items, counts] = await Promise.all([
    db.select().from(couponItem).where(inArray(couponItem.couponId, ids)),
    db.execute(sql`
      select coupon_id as "couponId", count(*) filter (where status = 'reserved')::int as used,
             count(*) filter (where status = 'reserved' and user_id = ${Number(userId)})::int as "usedByUser"
      from coupon_redemption where coupon_id in (${sql.join(ids.map((i) => sql`${i}`), sql`, `)}) group by coupon_id`),
  ]);
  const itemsBy = new Map();
  for (const i of items) itemsBy.set(i.couponId, [...(itemsBy.get(i.couponId) ?? []), Number(i.itemId)]);
  const countsBy = new Map(counts.rows.map((r) => [Number(r.couponId), r]));
  return rows.map(({ c, source, s }) => {
    const n = countsBy.get(c.id) ?? { used: 0, usedByUser: 0 };
    return present(c, {
      store: { id: s.id, name: s.name, currency: s.currency, iconUrl: s.iconPath ? `/uploads/${s.iconPath}` : null },
      inWallet: source != null,
      source: source ?? null,
      state: couponState({ coupon: c, used: n.used, usedByUser: n.usedByUser }),
      itemIds: itemsBy.get(c.id) ?? [],
    });
  });
}

const walletRows = (userId, extra = []) =>
  db
    .select({ c: coupon, source: couponWallet.source, s: store })
    .from(coupon)
    .innerJoin(store, eq(store.id, coupon.storeId))
    .leftJoin(couponWallet, and(eq(couponWallet.couponId, coupon.id), eq(couponWallet.userId, Number(userId))))
    .where(and(isNull(coupon.deletedAt), eq(store.status, 'active'), isNull(store.deletedAt), or(isNotNull(couponWallet.userId), eq(coupon.audience, 'public')), ...extra))
    .orderBy(desc(coupon.id));

// Mis cupones (asignados o guardados) y los públicos que aún puedo guardar.
export async function listMyCoupons(userId, query) {
  const limit = query.limit === undefined ? 20 : integer(query.limit, 'limit', 1, 50, 'INVALID_LIMIT');
  const extra = [];
  if (query.storeId !== undefined) extra.push(eq(coupon.storeId, integer(query.storeId, 'storeId', 1, Number.MAX_SAFE_INTEGER, 'INVALID_STORE')));
  if (query.status !== undefined && !STATES.includes(query.status)) throw bad(`status must be one of ${STATES.join(', ')}`, 'INVALID_STATUS');
  let views = await buyerViews(userId, await walletRows(userId, extra));
  if (query.status !== undefined) views = views.filter((v) => v.state === query.status);
  if (query.cursor !== undefined) {
    const cursor = Number(query.cursor);
    if (!Number.isSafeInteger(cursor)) throw bad('cursor is not valid', 'INVALID_CURSOR');
    views = views.filter((v) => v.id < cursor);
  }
  const page = views.slice(0, limit);
  return { coupons: page, nextCursor: views.length > limit ? String(page.at(-1).id) : null };
}

// Guarda un cupón público en la cartera.
export async function claimCoupon(userId, idParam) {
  const id = parseId(idParam, 'Coupon not found', 'COUPON_NOT_FOUND');
  const [found] = await walletRows(userId, [eq(coupon.id, id)]);
  if (!found) throw notFound();
  if (found.source == null) {
    if (found.c.endsAt && found.c.endsAt <= new Date()) throw new HttpError(409, 'The coupon has expired', 'COUPON_EXPIRED');
    await db.insert(couponWallet).values({ couponId: id, userId: Number(userId), source: 'claimed' }).onConflictDoNothing();
  }
  const [view] = await buyerViews(userId, await walletRows(userId, [eq(coupon.id, id)]));
  return { coupon: view, created: found.source == null };
}

// Aplica un cupón al carrito (máximo uno: reemplaza al anterior). Valida igual que el checkout, sin bloquear.
export async function applyCouponToCart(userId, body) {
  const b = object(body);
  const c = await activeCart(userId);
  const priced = await priceCart(c.id);
  if (priced.rows.length === 0) throw new HttpError(409, 'Add items to the cart before applying a coupon', 'CART_EMPTY');

  let couponId;
  let byCode = false;
  if (b.couponId !== undefined) {
    couponId = integer(b.couponId, 'couponId', 1, Number.MAX_SAFE_INTEGER, 'INVALID_COUPON');
  } else if (b.code !== undefined) {
    const code = str(b.code).toUpperCase();
    if (!code) throw bad('code is required', 'INVALID_CODE');
    const [found] = await db
      .select({ id: coupon.id })
      .from(coupon)
      .where(and(eq(coupon.storeId, priced.storeId), sql`lower(${coupon.code}) = ${code.toLowerCase()}`, isNull(coupon.deletedAt)));
    if (!found) throw notFound();
    couponId = found.id;
    byCode = true;
  } else {
    throw bad('Send couponId or code', 'COUPON_REQUIRED');
  }

  let facts = await loadCouponFacts(db, couponId, userId);
  if (!facts.inWallet) {
    // Un cupón público se guarda solo al escribir su código; los asignados a otras personas no se revelan.
    if (facts.coupon.audience !== 'public' || facts.coupon.storeId !== priced.storeId) {
      if (facts.coupon.audience === 'public') throw new HttpError(409, 'The coupon belongs to another store', 'COUPON_WRONG_STORE');
      throw notFound();
    }
    if (!byCode) throw new HttpError(403, 'Save the coupon first', 'COUPON_NOT_ELIGIBLE');
    await db.insert(couponWallet).values({ couponId, userId: Number(userId), source: 'claimed' }).onConflictDoNothing();
    facts = await loadCouponFacts(db, couponId, userId);
  }
  evaluateCoupon(facts, {
    storeId: priced.storeId,
    lines: priced.buyable.map((l) => ({ itemId: l.r.item.id, lineAmount: l.price.line })),
    itemTotal: priced.totals.total,
  });
  await db.update(cart).set({ couponId, updatedAt: new Date() }).where(eq(cart.id, c.id));
  return viewCart(userId);
}

export async function removeCartCoupon(userId) {
  const c = await activeCart(userId);
  await db.update(cart).set({ couponId: null, updatedAt: new Date() }).where(eq(cart.id, c.id));
  return viewCart(userId);
}
