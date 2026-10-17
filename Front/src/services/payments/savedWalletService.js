import { API_BASE_URL, ApiError, DATA_SOURCE, request } from '../api/client';
import { normalizeWalletAddress } from '../../lib/paymentWallet';

// Local address book until the backend publishes its wallet management contract.
// A saved address does not represent a verified or linked payment account.
const keyFor = userId => `lokora:saved-wallets:${encodeURIComponent(API_BASE_URL)}:${encodeURIComponent(userId)}`;
function read(userId) {
  if (!userId) throw new Error('Inicia sesión para guardar tus wallets.');
  const value = JSON.parse(localStorage.getItem(keyFor(userId)) || '[]');
  if (!Array.isArray(value)) throw new Error('No pudimos leer tus wallets guardadas.');
  return value;
}
function write(userId, wallets) {
  localStorage.setItem(keyFor(userId), JSON.stringify(wallets));
  return wallets;
}
const local = {
  list: read,
  add(userId, { name, address }) {
    const normalized = normalizeWalletAddress(address);
    const wallets = read(userId);
    if (wallets.some(wallet => wallet.address === normalized)) throw new Error('Esta dirección ya está guardada.');
    const label = name.trim();
    if (!label || label.length > 60) throw new Error('Escribe un nombre de hasta 60 caracteres.');
    return write(userId, [...wallets, { id: crypto.randomUUID(), name: label, address: normalized, preferred: wallets.length === 0 }]);
  },
  prefer(userId, id) {
    const wallets = read(userId);
    if (!wallets.some(wallet => wallet.id === id)) throw new Error('No encontramos esta wallet.');
    return write(userId, wallets.map(wallet => ({ ...wallet, preferred: wallet.id === id })));
  },
  remove(userId, id) {
    const wallets = read(userId).filter(wallet => wallet.id !== id);
    if (wallets.length && !wallets.some(wallet => wallet.preferred)) wallets[0].preferred = true;
    return write(userId, wallets);
  },
};

function readWallet(wallet) {
  if (wallet?.id == null || typeof wallet.address !== 'string' || typeof wallet.isPrimary !== 'boolean') throw new ApiError('La respuesta de wallets no coincide con el contrato de la API.', { code: 'INVALID_RESPONSE' });
  return { id: String(wallet.id), name: wallet.name || wallet.address, address: normalizeWalletAddress(wallet.address), preferred: wallet.isPrimary,
    currency: wallet.assetCode || null, scale: wallet.assetScale, source: 'api' };
}
const http = {
  async list(_userId, options = {}) {
    const result = await request('/me/wallets', options);
    if (!Array.isArray(result?.wallets)) throw new ApiError('La respuesta de wallets no coincide con el contrato de la API.', { code: 'INVALID_RESPONSE' });
    return result.wallets.map(readWallet);
  },
  add(_userId, { name, address }) {
    const label = name.trim();
    if (!label || label.length > 60) throw new Error('Escribe un nombre de hasta 60 caracteres.');
    return request('/me/wallets', { method: 'POST', body: { name: label, address: normalizeWalletAddress(address) } });
  },
};
// API mode never falls back to local addresses: the authenticated account owns
// the remote list. Existing browser drafts are not uploaded automatically.
export const savedWalletService = DATA_SOURCE === 'api' ? http : local;
