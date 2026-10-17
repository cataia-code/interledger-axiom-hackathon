import { ApiError, collectPages } from '../api/client';

export function primaryReceivingWallet(store) {
  if (!Array.isArray(store?.wallets)) throw new ApiError('No pudimos verificar las wallets receptoras de esta tienda.', { code: 'INVALID_STORE_WALLETS' });
  return store.wallets.find(wallet => wallet.isPrimary === true && typeof wallet.address === 'string' && wallet.address.trim()) || null;
}
export const storeWalletService = {
  async get(storeId, options = {}) {
    const stores = await collectPages('/stores', 'stores', {}, { ...options, auth: false });
    const store = stores.find(store => String(store.id) === String(storeId));
    if (!store) throw new ApiError('No pudimos verificar las wallets receptoras de esta tienda.', { code: 'INVALID_STORE_WALLETS' });
    const wallet = primaryReceivingWallet(store);
    return { store, wallet, primaryWallet: wallet };
  },
};
