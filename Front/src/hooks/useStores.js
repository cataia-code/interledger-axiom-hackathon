import { useCallback, useEffect, useState } from 'react';
import { marketplaceService } from '../services/marketplace/marketplaceService';
export function useStores() {
  const [shops, setShops] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const refreshStores = useCallback(async () => {
    setStatus('loading'); setError('');
    try { const stores = await marketplaceService.listStores(); setShops(stores); setStatus('ready'); }
    catch (cause) { setStatus('error'); setError(cause.message); }
  }, []);
  useEffect(() => { refreshStores(); }, [refreshStores]);
  async function createStore(input) { const store = await marketplaceService.createStore(input); setShops(current => [...current, store]); return store; }
  return { shops, storesStatus: status, storesError: error, refreshStores, createStore, findShop: id => shops.find(shop => shop.id === id) };
}
