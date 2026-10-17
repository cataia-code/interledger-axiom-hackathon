import { shops as seedShops } from '../../data/shops';
import { categoryIcons, neighborhoods } from '../../data/categories';
import { REFERENCE_RATE } from '../../lib/currency';

const STORAGE_KEY = 'lokora:mock:v2';
const empty = { user: null, accounts: [], stores: [], wallets: {} };
function read() { try { return { ...empty, ...JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}') }; } catch { return structuredClone(empty); } }
let state = read();
function save(next) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
  catch { throw new Error('No hay espacio para guardar esas imágenes. Prueba con archivos más pequeños.'); }
  state = next;
}
const wait = () => new Promise(resolve => setTimeout(resolve, 180));
const copy = data => structuredClone(data);
const catalog = () => [...seedShops, ...state.stores];
const walletKey = () => state.user?.id || 'visitor';
const initialWallet = () => ({ balanceUSD: 120, currency: 'USD', payments: [] });
const userId = email => `user-${Array.from(email).reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 0).toString(36)}`;

export const mockRepository = {
  async listStores() { await wait(); return copy(catalog()); },
  async getStore(id) { await wait(); const store = catalog().find(item => item.id === id); if (!store) throw new Error('No encontramos esta tienda.'); return copy(store); },
  async getSession() { return copy(state.user); },
  async login({ email }) {
    await wait(); const normalized = email.trim().toLowerCase();
    const user = state.accounts.find(account => account.email === normalized) || { id: userId(normalized), email: normalized,
      name: normalized === 'lucia@ejemplo.com' ? 'Lucía Martínez' : normalized.split('@')[0].replace(/[._-]/g, ' '), capabilities: ['buy', 'sell'] };
    save({ ...state, user }); return copy(user);
  },
  async register({ name, email }) {
    await wait(); const normalized = email.trim().toLowerCase();
    if (state.accounts.some(account => account.email === normalized)) throw new Error('Este correo ya está registrado en la demostración. Inicia sesión.');
    const user = { id: userId(normalized), email: normalized, name: name.trim(), capabilities: ['buy', 'sell'] };
    save({ ...state, user, accounts: [...state.accounts, user] }); return copy(user);
  },
  async logout() { save({ ...state, user: null }); },
  async createStore(input) {
    await wait(); if (!state.user) throw new Error('Inicia sesión para crear tu tienda.');
    if (state.stores.some(store => store.ownerId === state.user.id)) throw new Error('Ya tienes una tienda. Puedes gestionarla desde tu perfil.');
    const area = neighborhoods.find(item => item.name === input.neighborhood) || neighborhoods[0];
    const store = { id: `local-${crypto.randomUUID()}`, ownerId: state.user.id,
      name: input.name.trim(), category: input.category, categoryIcon: categoryIcons[input.category], type: input.category,
      description: input.description.trim(), address: input.address.trim(), area: `${area.name}, Medellín`, city: 'Medellín',
      lat: area.lat, lng: area.lng, distance: 'En tu ciudad', rating: 0, reviews: 0, price: 0, offer: 'Nueva tienda',
      logo: input.logo || '/assets/shops/craft-logo.svg', cover: input.cover || '/assets/medellin-colores.png', products: [] };
    save({ ...state, stores: [...state.stores, store] }); return copy(store);
  },
  async getWallet() { await wait(); return copy(state.wallets[walletKey()] || initialWallet()); },
  async pay({ shopId, amount, note }) {
    await wait(); if (!state.user) throw new Error('Inicia sesión para completar tu pago de ejemplo.');
    if (!catalog().some(store => store.id === shopId)) throw new Error('La tienda ya no está disponible.');
    const key = walletKey(); const wallet = state.wallets[key] || initialWallet();
    const debit = Math.round(amount / REFERENCE_RATE * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Ingresa un monto mayor que cero.');
    if (debit > wallet.balanceUSD) throw new Error('Tu saldo de ejemplo no alcanza para este pago.');
    const payment = { id: crypto.randomUUID(), shopId, amount, debit, note, date: new Date().toISOString() };
    const nextWallet = { ...wallet, balanceUSD: Math.round((wallet.balanceUSD - debit) * 100) / 100, payments: [payment, ...wallet.payments] };
    save({ ...state, wallets: { ...state.wallets, [key]: nextWallet } }); return copy(nextWallet);
  },
};
