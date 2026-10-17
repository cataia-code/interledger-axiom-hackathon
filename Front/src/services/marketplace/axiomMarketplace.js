import { ApiError, collectPages, request, resolveImageURL } from '../api/client';
import { normalizeItem } from './itemAdapter';
import { normalizeStore } from './storeAdapter';
function adaptStore(store, items = [], categories = []) {
  const names = new Map(categories.map(category => [String(category.id), category.name]));
  const products = items.map(item => ({ ...normalizeItem(item), category: names.get(String(item.categoryId)) }));
  return normalizeStore({ ...store, id: String(store.id), lat: store.latitude == null ? null : Number(store.latitude), lng: store.longitude == null ? null : Number(store.longitude),
    city: store.city, area: [store.address, store.city].filter(Boolean).join(' · '), currency: store.currency,
    // Public store media are relative to the API host, outside /api/v1.
    logo: resolveImageURL(store.iconUrl || store.logo),
    cover: resolveImageURL(store.bannerUrl || store.cover),
    products, price: products.length ? Math.min(...products.map(product => product.price)) : 0,
  });
}
export const axiomMarketplace = {
  async getProduct(id, options = {}) { return normalizeItem((await request(`/items/${encodeURIComponent(id)}`, { ...options, auth: false })).item); },
  listItems: (query = {}, options = {}) => collectPages('/items', 'items', query, { ...options, auth: false }),
  async getStore(id, options = {}) {
    const [result, items, categories] = await Promise.all([
      request(`/stores/${encodeURIComponent(id)}`, { ...options, auth: false }),
      collectPages('/items', 'items', { storeId: id }, { ...options, auth: false }),
      request(`/stores/${encodeURIComponent(id)}/categories`, { ...options, auth: false }),
    ]);
    return adaptStore(result.store, items, categories.categories);
  },
  async getOwnStore(ownerId) {
    const result = await request('/seller/store');
    return { ...adaptStore(result.store), ownerId: String(ownerId) };
  },
  async updateStore(id, values) {
    const result = await request('/seller/store', { method: 'PATCH', body: values });
    return adaptStore(result.store);
  },
  async listStores() {
    // The store directory is authoritative and includes shops without products.
    const [stores, items] = await Promise.all([
      collectPages('/stores', 'stores', {}, { auth: false }),
      collectPages('/items', 'items', {}, { auth: false }),
    ]);
    const itemsByStore = new Map();
    for (const item of items) {
      const key = String(item.storeId);
      if (!itemsByStore.has(key)) itemsByStore.set(key, []);
      itemsByStore.get(key).push(item);
    }
    return stores
      .filter(store => !store.status || store.status === 'active')
      .map(store => adaptStore(store, itemsByStore.get(String(store.id)) || []));
  },
  async createStore() { throw new ApiError('La sucursal se crea durante el registro de vendedor, junto con su organización.', { code: 'SELLER_ONBOARDING_REQUIRED' }); },
};
