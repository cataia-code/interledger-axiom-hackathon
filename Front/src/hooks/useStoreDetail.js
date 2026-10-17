import { useEffect, useState } from 'react';
import { marketplaceService } from '../services/marketplace/marketplaceService';

export function useStoreDetail(id, initialStore, onLoaded) {
  const [store, setStore] = useState(initialStore);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setPending(true);
    setError('');
    marketplaceService.getStore(id, { signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return;
      setStore(result);
      onLoaded(result);
    }).catch(cause => { if (!controller.signal.aborted) setError(cause.message); })
      .finally(() => { if (!controller.signal.aborted) setPending(false); });
    return () => controller.abort();
  }, [id, onLoaded]);
  return { store, pending, error };
}
