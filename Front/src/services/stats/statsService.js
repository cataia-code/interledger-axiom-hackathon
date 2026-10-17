import { ApiError, queryPath, request } from '../api/client';

export const statsService = {
  getMarketplace: (query = {}, options = {}) => request(queryPath('/stats', query), options),
  async getStore(id, options = {}) {
    const result = await request(`/stores/${encodeURIComponent(id)}/stats`, options);
    if (!result.stats || String(result.stats.storeId) !== String(id)) throw new ApiError('Las estadísticas recibidas no corresponden a la tienda.', { code: 'INVALID_RESPONSE' });
    return result.stats;
  },
  // Seller-only: never request or expose private sales from the buyer's Impact section.
  getSeller: (options = {}) => request('/seller/stats', options),
};

// The public store example is supplied by backend. Marketplace shape is provisional
// until /stats has a complete example; only render numeric counters explicitly sent.
export function marketplaceView(result) {
  const source = result?.stats || result;
  const count = key => Number.isSafeInteger(source?.[key]) && source[key] >= 0 ? source[key] : null;
  const overview = { stores: count('stores'), items: count('items'), orders: count('orders'), users: count('users'), topStores: Array.isArray(source?.topStores) ? source.topStores : [] };
  return ['stores', 'items', 'orders', 'users'].some(key => overview[key] != null) ? overview : null;
}
