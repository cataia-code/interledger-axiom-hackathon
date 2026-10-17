import { DATA_SOURCE, request } from '../api/client';
import { mockRepository } from '../api/mockRepository';
const http = {
  listStores: () => request('/stores'),
  getStore: id => request(`/stores/${encodeURIComponent(id)}`),
  createStore: store => request('/stores', { method: 'POST', body: store }),
};
export const marketplaceService = DATA_SOURCE === 'api' ? http : mockRepository;
