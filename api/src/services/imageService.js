import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { and, asc, eq, sql } from 'drizzle-orm';
import sharp from 'sharp';
import { config } from '../config/index.js';
import { db } from '../db/index.js';
import { itemImage } from '../db/catalog.js';
import { HttpError } from '../middlewares/errorHandler.js';
import { bad, object, parseId } from './validation.js';
import { findOwnItem } from './itemService.js';

// Todas las imágenes se guardan como WebP cuadrado de tamaño fijo; no se conserva el original.
export const IMAGE_SIZE = 1024;
export const MAX_IMAGES_PER_ITEM = 8;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const absolute = (relative) => path.join(config.uploadDir, relative);

async function normalize(buffer) {
  try {
    return await sharp(buffer, { limitInputPixels: 50_000_000 })
      .rotate()
      .resize(IMAGE_SIZE, IMAGE_SIZE, { fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw bad('The file is not a valid image', 'INVALID_IMAGE');
  }
}

const imagesOf = (itemId) => db.select().from(itemImage).where(eq(itemImage.itemId, itemId)).orderBy(asc(itemImage.position));

export async function addImage(storeId, idParam, file) {
  const item = await findOwnItem(storeId, idParam);
  if (!file) throw bad('Send the image in the "image" field (multipart/form-data)', 'IMAGE_REQUIRED');
  const { data, info } = await normalize(file.buffer);
  const relative = path.join('items', String(item.id), `${randomUUID()}.webp`);
  await mkdir(path.dirname(absolute(relative)), { recursive: true });
  await writeFile(absolute(relative), data);
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`select id from item where id = ${item.id} for update`);
      const existing = await tx.select().from(itemImage).where(eq(itemImage.itemId, item.id));
      if (existing.length >= MAX_IMAGES_PER_ITEM) throw new HttpError(409, `An item can have at most ${MAX_IMAGES_PER_ITEM} images`, 'IMAGE_LIMIT');
      const position = existing.reduce((max, i) => Math.max(max, i.position), 0) + 1;
      const [row] = await tx
        .insert(itemImage)
        .values({ itemId: item.id, path: relative.split(path.sep).join('/'), width: info.width, height: info.height, sizeBytes: info.size, position })
        .returning();
      return row;
    });
  } catch (err) {
    await rm(absolute(relative), { force: true });
    throw err;
  }
}

export async function deleteImage(storeId, idParam, imageParam) {
  const item = await findOwnItem(storeId, idParam);
  const imageId = parseId(imageParam, 'Image not found', 'IMAGE_NOT_FOUND');
  const [row] = await db.delete(itemImage).where(and(eq(itemImage.id, imageId), eq(itemImage.itemId, item.id))).returning();
  if (!row) throw new HttpError(404, 'Image not found', 'IMAGE_NOT_FOUND');
  await rm(absolute(row.path), { force: true });
  await repack(item.id);
}

const repack = async (itemId) => setOrder((await imagesOf(itemId)).map((i) => i.id));

// Dos pasos para no chocar con UNIQUE (item_id, position).
async function setOrder(ids) {
  await db.transaction(async (tx) => {
    for (const id of ids) await tx.update(itemImage).set({ position: -id }).where(eq(itemImage.id, id));
    for (const [index, id] of ids.entries()) await tx.update(itemImage).set({ position: index + 1 }).where(eq(itemImage.id, id));
  });
}

export async function reorderImages(storeId, idParam, body) {
  const item = await findOwnItem(storeId, idParam);
  const ids = object(body).ids;
  const current = await imagesOf(item.id);
  const valid =
    Array.isArray(ids) && ids.length === current.length && new Set(ids).size === ids.length && ids.every((id) => current.some((c) => c.id === id));
  if (!valid) throw bad('ids must list every image of the item exactly once', 'INVALID_IMAGE_ORDER');
  await setOrder(ids);
  return imagesOf(item.id);
}
