import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { like } from 'drizzle-orm';
import { existsSync } from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import sharp from 'sharp';
import app from '../src/app.js';
import { config } from '../src/config/index.js';
import { db, pool } from '../src/db/index.js';
import { user } from '../src/db/schema.js';
import { authed, newBuyer, newSeller, uniq } from './helpers.js';

const D = 'catalogtest.local';
const api = '/api/v1';
const png = (w = 300, h = 200) =>
  sharp({ create: { width: w, height: h, channels: 3, background: '#d33' } }).png().toBuffer();
const item = (extra = {}) => ({ sku: `SKU-${uniq()}`, name: 'Pan de masa madre', priceAmount: 2500, ...extra });

after(async () => {
  await db.delete(user).where(like(user.email, `%@${D}`));
  await pool.end();
});

test('categories belong to the store, form a tree and reject cycles', async () => {
  const { token } = await newSeller(D);
  const root = await authed(request(app).post(`${api}/seller/categories`), token).send({ name: 'Panes' });
  assert.equal(root.status, 201);
  assert.equal(root.body.category.slug, 'panes');
  assert.equal(typeof root.body.category.id, 'number');

  const dup = await authed(request(app).post(`${api}/seller/categories`), token).send({ name: 'Panes' });
  assert.equal(dup.status, 409);
  assert.equal(dup.body.error.code, 'CATEGORY_SLUG_EXISTS');

  const child = await authed(request(app).post(`${api}/seller/categories`), token).send({ name: 'Integrales', parentId: root.body.category.id });
  assert.equal(child.status, 201);
  const cycle = await authed(request(app).patch(`${api}/seller/categories/${root.body.category.id}`), token).send({ parentId: child.body.category.id });
  assert.equal(cycle.body.error.code, 'CATEGORY_CYCLE');
  assert.equal((await authed(request(app).post(`${api}/seller/categories`), token).send({ name: 'x' })).body.error.code, 'INVALID_NAME');

  // Otro seller no puede tocar ni usar la categoría.
  const other = await newSeller(D);
  assert.equal((await authed(request(app).patch(`${api}/seller/categories/${root.body.category.id}`), other.token).send({ name: 'Hack' })).status, 403);
  assert.equal((await authed(request(app).post(`${api}/seller/categories`), other.token).send({ name: 'Mía', parentId: root.body.category.id })).body.error.code, 'INVALID_PARENT');

  const list = await authed(request(app).get(`${api}/seller/categories`), token);
  assert.equal(list.body.categories.length, 2);
  assert.equal((await authed(request(app).delete(`${api}/seller/categories/${root.body.category.id}`), token)).status, 204);
  const after = await authed(request(app).get(`${api}/seller/categories`), token);
  assert.equal(after.body.categories[0].parentId, null); // la hija sube a la raíz
});

test('seller creates, edits and soft-deletes items with validation and ownership', async () => {
  const { token, store } = await newSeller(D);
  const cat = (await authed(request(app).post(`${api}/seller/categories`), token).send({ name: 'Panes' })).body.category;
  const sku = `SKU-${uniq()}`;
  const created = await authed(request(app).post(`${api}/seller/items`), token).send(item({ sku, categoryId: cat.id, description: ' Crujiente ' }));
  assert.equal(created.status, 201);
  const it = created.body.item;
  assert.equal(it.currency, store.currency);
  assert.equal(it.status, 'draft');
  assert.equal(it.description, 'Crujiente');
  assert.equal(it.finalPriceAmount, 2500);
  assert.equal(it.currentStock, 0);
  assert.equal(it.available, 0);

  assert.equal((await authed(request(app).post(`${api}/seller/items`), token).send(item({ sku }))).body.error.code, 'SKU_ALREADY_EXISTS');
  const invalid = [
    [{ sku: '' }, 'INVALID_SKU'],
    [{ name: 'a' }, 'INVALID_NAME'],
    [{ priceAmount: -1 }, 'INVALID_PRICE'],
    [{ priceAmount: 10.5 }, 'INVALID_PRICE'],
    [{ status: 'on-sale' }, 'INVALID_STATUS'],
    [{ categoryId: 999999 }, 'INVALID_CATEGORY'],
  ];
  for (const [extra, code] of invalid) {
    const res = await authed(request(app).post(`${api}/seller/items`), token).send(item(extra));
    assert.equal(res.status, 400, code);
    assert.equal(res.body.error.code, code);
  }

  const patched = await authed(request(app).patch(`${api}/seller/items/${it.id}`), token).send({ priceAmount: 3000, status: 'active' });
  assert.equal(patched.body.item.priceAmount, 3000);
  assert.equal(patched.body.item.status, 'active');
  assert.equal((await authed(request(app).patch(`${api}/seller/items/${it.id}`), token).send({})).body.error.code, 'EMPTY_UPDATE');

  const other = await newSeller(D);
  assert.equal((await authed(request(app).get(`${api}/seller/items/${it.id}`), other.token)).status, 403);
  assert.equal((await authed(request(app).patch(`${api}/seller/items/${it.id}`), other.token).send({ name: 'Hack' })).status, 403);
  assert.equal((await authed(request(app).get(`${api}/seller/items/999999`), token)).status, 404);
  assert.equal((await authed(request(app).get(`${api}/seller/items/abc`), token)).status, 404);
  const buyer = await newBuyer(D);
  assert.equal((await authed(request(app).get(`${api}/seller/items`), buyer.token)).status, 403);

  assert.equal((await authed(request(app).delete(`${api}/seller/items/${it.id}`), token)).status, 204);
  assert.equal((await authed(request(app).get(`${api}/seller/items/${it.id}`), token)).status, 404);
  assert.equal((await request(app).get(`${api}/items/${it.id}`)).status, 404);
});

test('discounts: percent and fixed, one at a time, final price in the public view', async () => {
  const { token } = await newSeller(D);
  const it = (await authed(request(app).post(`${api}/seller/items`), token).send(item({ priceAmount: 10000, status: 'active' }))).body.item;
  const url = `${api}/seller/items/${it.id}/discounts`;

  const bad = [
    [{ type: 'weird', value: 1 }, 'INVALID_DISCOUNT_TYPE'],
    [{ type: 'percent', value: 10001 }, 'INVALID_DISCOUNT_VALUE'],
    [{ type: 'fixed', value: 10000 }, 'INVALID_DISCOUNT_VALUE'],
    [{ type: 'percent', value: 100, startsAt: '2030-01-02T00:00:00Z', endsAt: '2030-01-01T00:00:00Z' }, 'INVALID_DISCOUNT_DATES'],
  ];
  for (const [body, code] of bad) assert.equal((await authed(request(app).post(url), token).send(body)).body.error.code, code);

  const pct = await authed(request(app).post(url), token).send({ type: 'percent', value: 1500 }); // 15 %
  assert.equal(pct.status, 201);
  const pub = await request(app).get(`${api}/items/${it.id}`);
  assert.equal(pub.body.item.discountAmount, 1500);
  assert.equal(pub.body.item.finalPriceAmount, 8500);
  assert.equal(pub.body.item.discount.type, 'percent');

  const overlap = await authed(request(app).post(url), token).send({ type: 'fixed', value: 500 });
  assert.equal(overlap.status, 409);
  assert.equal(overlap.body.error.code, 'DISCOUNT_OVERLAP');

  // Desactivar libera el período.
  const off = await authed(request(app).delete(`${url}/${pct.body.discount.id}`), token);
  assert.equal(off.body.discount.active, false);
  assert.equal((await request(app).get(`${api}/items/${it.id}`)).body.item.finalPriceAmount, 10000);

  const fixed = await authed(request(app).post(url), token).send({ type: 'fixed', value: 2500 });
  assert.equal(fixed.status, 201);
  assert.equal((await request(app).get(`${api}/items/${it.id}`)).body.item.finalPriceAmount, 7500);

  const future = await authed(request(app).post(url), token).send({ type: 'percent', value: 5000, startsAt: '2099-01-01T00:00:00Z' });
  assert.equal(future.status, 409); // el fijo no tiene fin, se solapa
  const detail = await authed(request(app).get(`${api}/seller/items/${it.id}`), token);
  assert.equal(detail.body.item.discounts.length, 2);
});

test('public listing: only active items, search, category filter, sort and cursor pagination', async () => {
  const tag = uniq();
  const { token, store } = await newSeller(D);
  const cat = (await authed(request(app).post(`${api}/seller/categories`), token).send({ name: `Dulces ${tag}` })).body.category;
  const make = (extra) => authed(request(app).post(`${api}/seller/items`), token).send(item({ status: 'active', ...extra }));
  await make({ name: `Alfajor ${tag}`, priceAmount: 300, categoryId: cat.id });
  await make({ name: `Brownie ${tag}`, priceAmount: 100, categoryId: cat.id, description: 'con nueces' });
  await make({ name: `Churro ${tag}`, priceAmount: 200 });
  await make({ name: `Borrador ${tag}`, priceAmount: 50, status: 'draft' });
  await make({ name: `100% real_${tag}`, priceAmount: 400 });

  const list = (q) => request(app).get(`${api}/items`).query({ storeId: store.id, ...q });
  const all = await list({ sort: 'price_asc' });
  assert.deepEqual(all.body.items.map((i) => i.priceAmount), [100, 200, 300, 400]);
  assert.equal(all.body.items[0].currency, 'USD');
  assert.equal((await list({ sort: 'price_desc' })).body.items[0].priceAmount, 400);
  assert.equal((await list({ categoryId: cat.id })).body.items.length, 2);
  assert.equal((await list({ q: 'NUECES' })).body.items.length, 1);
  assert.equal((await list({ q: '100%' })).body.items.length, 1); // el % se trata literal
  assert.equal((await list({ q: `borrador ${tag}` })).body.items.length, 0); // borrador oculto

  const p1 = await list({ sort: 'price_asc', limit: 3 });
  assert.equal(p1.body.items.length, 3);
  assert.ok(p1.body.nextCursor);
  const p2 = await list({ sort: 'price_asc', limit: 3, cursor: p1.body.nextCursor });
  assert.deepEqual(p2.body.items.map((i) => i.priceAmount), [400]);
  assert.equal(p2.body.nextCursor, null);
  const n1 = await list({ limit: 2 });
  const n2 = await list({ limit: 2, cursor: n1.body.nextCursor });
  assert.equal(new Set([...n1.body.items, ...n2.body.items].map((i) => i.id)).size, 4);

  assert.equal((await list({ sort: 'cheapest' })).body.error.code, 'INVALID_SORT');
  assert.equal((await list({ limit: 0 })).body.error.code, 'INVALID_LIMIT');
  assert.equal((await list({ cursor: 'zzz' })).body.error.code, 'INVALID_CURSOR');

  const cats = await request(app).get(`${api}/stores/${store.id}/categories`);
  assert.equal(cats.body.categories.length, 1);

  // Una sucursal en pausa deja de mostrar sus ítems.
  await authed(request(app).patch(`${api}/seller/store`), token).send({ status: 'paused' });
  assert.equal((await list({})).body.items.length, 0);
});

test('images are validated, normalized to a fixed WebP size, served, reordered and deleted', async () => {
  const { token } = await newSeller(D);
  const it = (await authed(request(app).post(`${api}/seller/items`), token).send(item())).body.item;
  const url = `${api}/seller/items/${it.id}/images`;
  const upload = (buf, name = 'a.png', type = 'image/png') => authed(request(app).post(url), token).attach('image', buf, { filename: name, contentType: type });

  const ok = await upload(await png(300, 200));
  assert.equal(ok.status, 201);
  assert.equal(ok.body.image.width, 1024);
  assert.equal(ok.body.image.height, 1024);
  assert.equal(ok.body.image.position, 1);
  const file = path.join(config.uploadDir, ok.body.image.url.replace('/uploads/', ''));
  assert.ok(existsSync(file));
  assert.equal((await sharp(file).metadata()).format, 'webp');
  const served = await request(app).get(ok.body.image.url);
  assert.equal(served.status, 200);
  assert.equal(served.headers['content-type'], 'image/webp');

  assert.equal((await upload(Buffer.from('not an image'))).body.error.code, 'INVALID_IMAGE');
  assert.equal((await upload(Buffer.from('hello'), 'a.txt', 'text/plain')).body.error.code, 'INVALID_IMAGE_TYPE');
  assert.equal((await authed(request(app).post(url), token)).body.error.code, 'IMAGE_REQUIRED');
  assert.equal((await upload(Buffer.alloc(5 * 1024 * 1024 + 10), 'big.png')).status, 413);

  const second = await upload(await png(50, 50));
  const third = await upload(await png(60, 60));
  const order = [third.body.image.id, ok.body.image.id, second.body.image.id];
  const reordered = await authed(request(app).put(`${url}/order`), token).send({ ids: order });
  assert.deepEqual(reordered.body.images.map((i) => i.id), order);
  assert.equal((await authed(request(app).put(`${url}/order`), token).send({ ids: [order[0]] })).body.error.code, 'INVALID_IMAGE_ORDER');

  const detail = await authed(request(app).get(`${api}/seller/items/${it.id}`), token);
  assert.equal(detail.body.item.images.length, 3);

  assert.equal((await authed(request(app).delete(`${url}/${ok.body.image.id}`), token)).status, 204);
  assert.ok(!existsSync(file));
  const after = await authed(request(app).get(`${api}/seller/items/${it.id}`), token);
  assert.deepEqual(after.body.item.images.map((i) => i.position), [1, 2]);

  const other = await newSeller(D);
  assert.equal((await authed(request(app).post(url), other.token).attach('image', await png(), { filename: 'a.png', contentType: 'image/png' })).status, 403);
});

test('an item accepts at most 8 images', async () => {
  const { token } = await newSeller(D);
  const it = (await authed(request(app).post(`${api}/seller/items`), token).send(item())).body.item;
  const buf = await png(20, 20);
  for (let i = 0; i < 8; i++) {
    const r = await authed(request(app).post(`${api}/seller/items/${it.id}/images`), token).attach('image', buf, { filename: 'a.png', contentType: 'image/png' });
    assert.equal(r.status, 201);
  }
  const extra = await authed(request(app).post(`${api}/seller/items/${it.id}/images`), token).attach('image', buf, { filename: 'a.png', contentType: 'image/png' });
  assert.equal(extra.status, 409);
  assert.equal(extra.body.error.code, 'IMAGE_LIMIT');
});
