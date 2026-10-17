import { useEffect, useState } from 'react';
import { storeWalletService } from '../services/payments/storeWalletService';

export function useStoreReceivingWallet(storeId) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ storeId: null, status: 'idle', store: null, wallet: null, error: '' });
  useEffect(() => {
    if (storeId == null) return;
    const controller = new AbortController();
    setState({ storeId, status: 'loading', store: null, wallet: null, error: '' });
    storeWalletService.get(storeId, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) setState({ storeId, status: 'ready', ...result, error: '' });
    }).catch(cause => { if (!controller.signal.aborted) setState({ storeId, status: 'error', store: null, wallet: null, error: cause.message }); });
    return () => controller.abort();
  }, [storeId, revision]);
  return { ...(state.storeId === storeId ? state : { status: storeId == null ? 'idle' : 'loading', store: null, wallet: null, error: '' }), reload: () => setRevision(value => value + 1) };
}
