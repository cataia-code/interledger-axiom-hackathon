import { useCallback, useEffect, useRef, useState } from 'react';
import { DATA_SOURCE } from '../services/api/client';
import { marketplaceService } from '../services/marketplace/marketplaceService';
export function useStores(userId, role) {
  const [catalog, setCatalog] = useState({ ownerId: null, shops: [], status: 'idle', error: '' });
  const activeUser = useRef(userId);
  const requestSequence = useRef(0);
  activeUser.current = userId;
  const shops = catalog.ownerId === userId && userId ? catalog.shops : [];
  const refreshStores = useCallback(async () => {
    const requestId = ++requestSequence.current;
    if (!userId) { setCatalog({ ownerId: null, shops: [], status: 'idle', error: '' }); return; }
    setCatalog(current => ({ ownerId: userId, shops: current.ownerId === userId ? current.shops : [], status: 'loading', error: '' }));
    try {
      const [stores, ownStore] = await Promise.all([
        marketplaceService.listStores(),
        DATA_SOURCE === 'api' && role === 'seller' ? marketplaceService.getOwnStore(userId) : Promise.resolve(null),
      ]);
      if (ownStore) {
        const index = stores.findIndex(store => store.id === ownStore.id);
        if (index >= 0) stores[index] = { ...stores[index], ownerId: ownStore.ownerId };
        else stores.push(ownStore);
      }
      if (requestId === requestSequence.current && activeUser.current === userId) setCatalog({ ownerId: userId, shops: stores, status: 'ready', error: '' });
    } catch (cause) {
      if (requestId === requestSequence.current && activeUser.current === userId) setCatalog({ ownerId: userId, shops: [], status: 'error', error: cause.message });
    }
  }, [userId, role]);
  useEffect(() => { refreshStores(); return () => { requestSequence.current += 1; }; }, [refreshStores]);
  const cacheStore = useCallback(store => {
    if (!userId || activeUser.current !== userId) return;
    setCatalog(current => current.ownerId !== userId ? current : { ...current, shops: current.shops.some(item => item.id === store.id) ? current.shops.map(item => item.id === store.id ? store : item) : [...current.shops, store] });
  }, [userId]);
  async function createStore(input) {
    if (!userId) throw new Error('Inicia sesión para crear tu tienda.');
    const store = await marketplaceService.createStore(input); cacheStore(store); return store;
  }
  return { shops, cacheStore, storesStatus: !userId ? 'idle' : catalog.ownerId === userId ? catalog.status : 'loading', storesError: catalog.ownerId === userId ? catalog.error : '', refreshStores, createStore, findShop: id => shops.find(shop => shop.id === id) };
}
