import { DATA_SOURCE } from '../api/client';
import { mockRepository } from '../api/mockRepository';
import { axiomMarketplace } from './axiomMarketplace';
import { normalizeStore } from './storeAdapter';
const source = DATA_SOURCE === 'api' ? axiomMarketplace : mockRepository;
export const marketplaceService = {
  async getProduct(id, options) { return axiomMarketplace.getProduct(id, options); },
  async listStores() { return (await source.listStores()).map(normalizeStore); },
  async getStore(id, options) { return normalizeStore(await source.getStore(id, options)); },
  async createStore(values) { return normalizeStore(await source.createStore(values)); },
  async updateStore(id, values) { return normalizeStore(await source.updateStore(id, values)); },
  async getOwnStore(ownerId) { return DATA_SOURCE === 'api' ? axiomMarketplace.getOwnStore(ownerId) : null; },
};
