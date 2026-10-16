import { getPublicStore, getSellerContext } from '../services/sellerService.js';
import * as categories from '../services/categoryService.js';
import * as items from '../services/itemService.js';
import * as images from '../services/imageService.js';
import * as stock from '../services/stockService.js';

const handler = (status, fn) => async (req, res, next) => {
  try {
    const body = await fn(req);
    if (body === undefined) res.status(204).end();
    else res.status(status).json(body);
  } catch (err) {
    next(err);
  }
};

// Sucursal del seller autenticado (la propiedad de todo lo demás se deriva de ella).
const own = async (req) => (await getSellerContext(req.auth.user.id)).store;

// ---- seller: categorías ----
export const listOwnCategories = handler(200, async (req) => ({
  categories: (await categories.listCategories((await own(req)).id)).map(categories.presentCategory),
}));
export const postCategory = handler(201, async (req) => ({
  category: categories.presentCategory(await categories.createCategory((await own(req)).id, req.body)),
}));
export const patchCategory = handler(200, async (req) => ({
  category: categories.presentCategory(await categories.updateCategory((await own(req)).id, req.params.id, req.body)),
}));
export const removeCategory = handler(204, async (req) => {
  await categories.deleteCategory((await own(req)).id, req.params.id);
});

// ---- seller: ítems ----
export const listOwnItems = handler(200, async (req) => {
  const store = await own(req);
  return items.listOwnItems(store.id, store.currency, req.query);
});
export const postItem = handler(201, async (req) => {
  const store = await own(req);
  const row = await items.createItem(store.id, req.body, req.auth.user.id);
  return { item: await items.ownItemDetail(store.id, row.id, store.currency) };
});
export const getOwnItem = handler(200, async (req) => {
  const store = await own(req);
  return { item: await items.ownItemDetail(store.id, req.params.id, store.currency) };
});
export const patchItem = handler(200, async (req) => {
  const store = await own(req);
  const row = await items.updateItem(store.id, req.params.id, req.body);
  return { item: await items.ownItemDetail(store.id, row.id, store.currency) };
});
export const removeItem = handler(204, async (req) => {
  await items.deleteItem((await own(req)).id, req.params.id);
});

// ---- seller: descuentos ----
export const postDiscount = handler(201, async (req) => ({
  discount: items.presentDiscount(await items.createDiscount((await own(req)).id, req.params.id, req.body)),
}));
export const removeDiscount = handler(200, async (req) => ({
  discount: items.presentDiscount(await items.deactivateDiscount((await own(req)).id, req.params.id, req.params.discountId)),
}));

// ---- seller: stock ----
export const getStock = handler(200, async (req) => {
  const row = await items.findOwnItem((await own(req)).id, req.params.id);
  return { stock: await stock.stockSummary(row) };
});
export const postStockMovement = handler(201, async (req) => {
  const row = await items.findOwnItem((await own(req)).id, req.params.id);
  const movement = await stock.sellerMovement(row, req.auth.user.id, req.body);
  return { movement: stock.presentMovement(movement), stock: await stock.stockSummary({ ...row, currentStock: movement.stockAfter }) };
});
export const getStockMovements = handler(200, async (req) => {
  const row = await items.findOwnItem((await own(req)).id, req.params.id);
  return stock.listMovements(row.id, req.query);
});

// ---- seller: imágenes ----
export const postImage = handler(201, async (req) => ({
  image: items.presentImage(await images.addImage((await own(req)).id, req.params.id, req.file)),
}));
export const removeImage = handler(204, async (req) => {
  await images.deleteImage((await own(req)).id, req.params.id, req.params.imageId);
});
export const putImageOrder = handler(200, async (req) => ({
  images: (await images.reorderImages((await own(req)).id, req.params.id, req.body)).map(items.presentImage),
}));

// ---- público ----
export const listStoreCategories = handler(200, async (req) => {
  const store = await getPublicStore(req.params.id);
  return { categories: (await categories.listCategories(store.id)).map(categories.presentCategory) };
});
export const listItems = handler(200, (req) => items.listPublicItems(req.query));
export const getItem = handler(200, async (req) => ({ item: await items.getPublicItem(req.params.id) }));
