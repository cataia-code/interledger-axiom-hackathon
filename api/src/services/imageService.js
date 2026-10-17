import { randomUUID } from 'node:crypto';
import { and, asc, eq, sql } from 'drizzle-orm';
import sharp from 'sharp';
import { db } from '../db/index.js';
import { itemImage } from '../db/catalog.js';
import { store } from '../db/business.js';
import { storage } from '../storage/index.js';
import { HttpError } from '../middlewares/errorHandler.js';
import { bad, object, parseId } from './validation.js';
import { findOwnItem } from './itemService.js';

// Las imágenes se guardan como WebP de tamaño fijo; no se conserva el original.
// Ítems: cuadrado 1024. Tienda: banner 1600×600 e icono circular de 256 (con transparencia, listo como pin de mapa).
export const IMAGE_SIZE = 1024;
export const BANNER_SIZE = { width: 1600, height: 600 };
export const ICON_SIZE = 256;
export const STORE_IMAGE_KINDS = { banner: 'bannerPath', icon: 'iconPath' };
export const MAX_IMAGES_PER_ITEM = 8;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

async function normalize(buffer, { width = IMAGE_SIZE, height = IMAGE_SIZE, circle = false } = {}) {
  try {
    let image = sharp(buffer, { limitInputPixels: 50_000_000 }).rotate().resize(width, height, { fit: 'cover' });
    if (circle) {
      const mask = Buffer.from(`<svg width="${width}" height="${height}"><circle cx="${width / 2}" cy="${height / 2}" r="${width / 2}"/></svg>`);
      image = sharp(await image.png().toBuffer()).composite([{ input: mask, blend: 'dest-in' }]);
    }
    return await image.webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
  } catch {
    throw bad('The file is not a valid image', 'INVALID_IMAGE');
  }
}

const imagesOf = (itemId) => db.select().from(itemImage).where(eq(itemImage.itemId, itemId)).orderBy(asc(itemImage.position));

export async function addImage(storeId, idParam, file) {
  const item = await findOwnItem(storeId, idParam);
  if (!file) throw bad('Send the image in the "image" field (multipart/form-data)', 'IMAGE_REQUIRED');
  const { data, info } = await normalize(file.buffer);
  const key = `items/${item.id}/${randomUUID()}.webp`;
  await storage.put(key, data, 'image/webp');
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`select id from item where id = ${item.id} for update`);
      const existing = await tx.select().from(itemImage).where(eq(itemImage.itemId, item.id));
      if (existing.length >= MAX_IMAGES_PER_ITEM) throw new HttpError(409, `An item can have at most ${MAX_IMAGES_PER_ITEM} images`, 'IMAGE_LIMIT');
      const position = existing.reduce((max, i) => Math.max(max, i.position), 0) + 1;
      const [row] = await tx
        .insert(itemImage)
        .values({ itemId: item.id, path: key, width: info.width, height: info.height, sizeBytes: info.size, position })
        .returning();
      return row;
    });
  } catch (err) {
    await storage.remove(key);
    throw err;
  }
}

export async function deleteImage(storeId, idParam, imageParam) {
  const item = await findOwnItem(storeId, idParam);
  const imageId = parseId(imageParam, 'Image not found', 'IMAGE_NOT_FOUND');
  const [row] = await db.delete(itemImage).where(and(eq(itemImage.id, imageId), eq(itemImage.itemId, item.id))).returning();
  if (!row) throw new HttpError(404, 'Image not found', 'IMAGE_NOT_FOUND');
  await storage.remove(row.path);
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

// ---------- imágenes de la tienda (banner e icono) ----------
// Reemplaza la imagen anterior: sube la nueva, actualiza la fila y borra la vieja.
export async function setStoreImage(storeRow, kind, file) {
  const column = STORE_IMAGE_KINDS[kind];
  if (!file) throw bad('Send the image in the "image" field (multipart/form-data)', 'IMAGE_REQUIRED');
  const { data } = await normalize(file.buffer, kind === 'banner' ? BANNER_SIZE : { width: ICON_SIZE, height: ICON_SIZE, circle: true });
  const key = `stores/${storeRow.id}/${kind}-${randomUUID()}.webp`;
  await storage.put(key, data, 'image/webp');
  try {
    const [row] = await db.update(store).set({ [column]: key }).where(eq(store.id, storeRow.id)).returning();
    if (storeRow[column]) await storage.remove(storeRow[column]);
    return row;
  } catch (err) {
    await storage.remove(key);
    throw err;
  }
}

export async function removeStoreImage(storeRow, kind) {
  const column = STORE_IMAGE_KINDS[kind];
  const [row] = await db.update(store).set({ [column]: null }).where(eq(store.id, storeRow.id)).returning();
  if (storeRow[column]) await storage.remove(storeRow[column]);
  return row;
}
