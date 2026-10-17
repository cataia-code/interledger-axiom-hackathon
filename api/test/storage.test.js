import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { like } from 'drizzle-orm';
import request from 'supertest';
import sharp from 'sharp';
import app from '../src/app.js';
import { config } from '../src/config/index.js';
import { db, pool } from '../src/db/index.js';
import { user } from '../src/db/schema.js';
import { createS3Storage, setStorage } from '../src/storage/index.js';
import { authed, newBuyer, newSeller } from './helpers.js';

const D = 'storagetest.local';
const api = '/api/v1';
const png = (w = 800, h = 800) => sharp({ create: { width: w, height: h, channels: 3, background: '#2a8' } }).png().toBuffer();
const upload = (path_, token, buf, type = 'image/png') => authed(request(app).put(`${api}${path_}`), token).attach('image', buf, { filename: 'a.png', contentType: type });
const onDisk = (url) => existsSync(path.join(config.uploadDir, url.replace('/uploads/', '')));

after(async () => {
  await db.delete(user).where(like(user.email, `%@${D}`));
  await pool.end();
});

test('store banner and icon: normalized, served, replaced, deleted and shown publicly', async () => {
  const { token, store } = await newSeller(D);
  assert.equal(store.bannerUrl ?? null, null);

  const banner = await upload('/seller/store/banner', token, await png(2000, 1000));
  assert.equal(banner.status, 200);
  const bannerUrl = banner.body.store.bannerUrl;
  assert.match(bannerUrl, new RegExp(`^/uploads/stores/${store.id}/banner-.+\\.webp$`));
  assert.equal(banner.body.store.iconUrl, null);

  const served = await request(app).get(bannerUrl).buffer(true).parse((res, cb) => {
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => cb(null, Buffer.concat(chunks)));
  });
  assert.equal(served.status, 200);
  assert.equal(served.headers['content-type'], 'image/webp');
  assert.match(served.headers['cache-control'], /immutable/);
  const meta = await sharp(served.body).metadata();
  assert.deepEqual([meta.width, meta.height], [1600, 600]);

  // El icono es circular: 256×256 con las esquinas transparentes.
  const icon = await upload('/seller/store/icon', token, await png(500, 300));
  assert.equal(icon.status, 200);
  const iconRaw = await request(app).get(icon.body.store.iconUrl).buffer(true).parse((res, cb) => {
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => cb(null, Buffer.concat(chunks)));
  });
  const { data, info } = await sharp(iconRaw.body).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([info.width, info.height], [256, 256]);
  assert.equal(data[3], 0, 'corner pixel is transparent');
  const center = (128 * 256 + 128) * 4;
  assert.equal(data[center + 3], 255, 'center pixel is opaque');

  // Se ve en la vista pública y en el listado.
  const pub = await request(app).get(`${api}/stores/${store.id}`);
  assert.equal(pub.body.store.bannerUrl, bannerUrl);
  assert.equal(pub.body.store.iconUrl, icon.body.store.iconUrl);
  const list = await request(app).get(`${api}/stores`).query({ q: store.name });
  assert.ok(list.body.stores.some((s) => s.id === store.id && s.iconUrl));

  // Reemplazar borra el archivo anterior.
  assert.ok(onDisk(bannerUrl));
  const second = await upload('/seller/store/banner', token, await png());
  assert.notEqual(second.body.store.bannerUrl, bannerUrl);
  assert.equal(onDisk(bannerUrl), false);
  assert.ok(onDisk(second.body.store.bannerUrl));

  // Borrar deja el campo en null y elimina el archivo.
  const del = await authed(request(app).delete(`${api}/seller/store/banner`), token);
  assert.equal(del.status, 200);
  assert.equal(del.body.store.bannerUrl, null);
  assert.equal(onDisk(second.body.store.bannerUrl), false);
  assert.equal((await request(app).get(second.body.store.bannerUrl)).status, 404);
});

test('store images are validated and restricted to sellers', async () => {
  const { token } = await newSeller(D);
  const none = await authed(request(app).put(`${api}/seller/store/icon`), token).send({});
  assert.equal(none.body.error.code, 'IMAGE_REQUIRED');
  const bad = await upload('/seller/store/icon', token, Buffer.from('not an image'));
  assert.equal(bad.body.error.code, 'INVALID_IMAGE');
  const wrongType = await upload('/seller/store/icon', token, Buffer.from('x'), 'text/plain');
  assert.equal(wrongType.body.error.code, 'INVALID_IMAGE_TYPE');

  const buyer = await newBuyer(D);
  assert.equal((await upload('/seller/store/banner', buyer.token, await png())).status, 403);
  assert.equal((await request(app).put(`${api}/seller/store/banner`)).status, 401);
});

test('uploads route rejects path traversal and unknown files', async () => {
  assert.equal((await request(app).get('/uploads/nope/none.webp')).status, 404);
  assert.equal((await request(app).get('/uploads/..%2f..%2fpackage.json')).status, 404);
  assert.equal((await request(app).get('/uploads/%2e%2e/package.json')).status, 404);
});

test('the S3 driver talks to the bucket and the API serves images from it', async () => {
  const objects = new Map();
  const sent = [];
  const client = {
    async send(cmd) {
      const { Bucket, Key, Body, ContentType } = cmd.input;
      sent.push([cmd.constructor.name, Bucket, Key]);
      switch (cmd.constructor.name) {
        case 'PutObjectCommand': objects.set(Key, { Body, ContentType }); return {};
        case 'DeleteObjectCommand': objects.delete(Key); return {};
        case 'GetObjectCommand': {
          const o = objects.get(Key);
          if (!o) throw Object.assign(new Error('missing'), { name: 'NoSuchKey' });
          return { Body: Readable.from(o.Body), ContentType: o.ContentType, ContentLength: o.Body.length };
        }
        default: throw new Error('unexpected command');
      }
    },
  };
  setStorage(createS3Storage({ client, bucket: 'test-bucket' }));
  try {
    const { token, store } = await newSeller(D);
    const res = await upload('/seller/store/icon', token, await png());
    const key = res.body.store.iconUrl.replace('/uploads/', '');
    assert.ok(objects.has(key), 'object stored in the bucket');
    assert.deepEqual(sent[0], ['PutObjectCommand', 'test-bucket', key]);
    assert.equal(objects.get(key).ContentType, 'image/webp');
    assert.equal(onDisk(res.body.store.iconUrl), false, 'nothing written to disk');

    const served = await request(app).get(res.body.store.iconUrl);
    assert.equal(served.status, 200);
    assert.equal(served.headers['content-type'], 'image/webp');

    await authed(request(app).delete(`${api}/seller/store/icon`), token);
    assert.equal(objects.has(key), false, 'object removed from the bucket');
    assert.equal((await request(app).get(res.body.store.iconUrl)).status, 404);
    assert.ok(store.id);
  } finally {
    setStorage(null);
  }
});
