import { shops as seedShops } from '../../data/shops';
import { categoryIcons, neighborhoods } from '../../data/categories';
import { normalizeWalletAddress } from '../../lib/paymentWallet';
import { REFERENCE_RATE } from '../../lib/currency';

const quotes = new Map();
const paidQuotes = new Map();
const STORAGE_KEY = 'lokora:mock:v2';
const empty = { user: null, accounts: [], stores: [], wallets: {} };
function read() { try { return { ...empty, ...JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}') }; } catch { return structuredClone(empty); } }
let state = read();
function withRole(user) {
  if (!user) return null;
  const role = user.role || (state.stores.some(store => String(store.ownerId) === String(user.id)) ? 'seller' : 'buyer');
  return { ...user, role, capabilities: [role === 'seller' ? 'sell' : 'buy'] };
}
state.user = withRole(state.user); state.accounts = state.accounts.map(withRole);
function save(next) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
  catch { throw new Error('No hay espacio para guardar esas imágenes. Prueba con archivos más pequeños.'); }
  state = next;
}
const wait = () => new Promise(resolve => setTimeout(resolve, 180));
const copy = data => structuredClone(data);
const catalog = () => [...seedShops, ...state.stores];
const walletKey = () => state.user?.id || 'visitor';
const initialWallet = () => ({ payments: [] });
const userId = email => `user-${Array.from(email).reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 0).toString(36)}`;

function defaultStoreLogo(name) {
  const initials = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9 ]/g, '').split(' ').filter(Boolean).slice(0, 2).map(word => word[0].toUpperCase()).join('') || 'L';
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" rx="28" fill="#f8f4e7"/><circle cx="80" cy="80" r="54" fill="#2e7d73" fill-opacity=".1"/><text x="80" y="94" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="43" fill="#1e3a52">${initials}</text><circle cx="121" cy="38" r="9" fill="#a12d4a"/></svg>`);
}

export const mockRepository = {
  async listStores() { await wait(); if (!state.user) throw new Error('Inicia sesión para explorar tiendas.'); return copy(catalog()); },
  async getStore(id) { await wait(); if (!state.user) throw new Error('Inicia sesión para ver los productos.'); const store = catalog().find(item => item.id === id); if (!store) throw new Error('No encontramos esta tienda.'); return copy(store); },
  async getSession() { return copy(state.user); },
  async login({ email }) {
    await wait(); const normalized = email.trim().toLowerCase();
    const user = withRole(state.accounts.find(account => account.email === normalized) || { id: userId(normalized), email: normalized,
      name: normalized === 'lucia@ejemplo.com' ? 'Lucía Martínez' : normalized.split('@')[0].replace(/[._-]/g, ' '), role: 'buyer', capabilities: ['buy'] });
    save({ ...state, user, accounts: [...state.accounts.filter(account => account.id !== user.id), user] }); return copy(user);
  },
  async register({ name, email, walletAddress, initialIntent }) {
    await wait(); const normalized = email.trim().toLowerCase();
    if (state.accounts.some(account => account.email === normalized)) throw new Error('Este correo ya está registrado en la demostración. Inicia sesión.');
    const user = { id: userId(normalized), email: normalized, name: name.trim(), role: initialIntent === 'sell' ? 'seller' : 'buyer', capabilities: [initialIntent === 'sell' ? 'sell' : 'buy'], paymentWallet: walletAddress?.trim() ? { address: normalizeWalletAddress(walletAddress), currency: 'USD', provider: 'Wallet externa', status: 'demo' } : null };
    save({ ...state, user, accounts: [...state.accounts, user] }); return copy(user);
  },
  async logout() { save({ ...state, user: null }); },
  async createStore(input) {
    await wait(); if (state.user?.role !== 'seller') throw new Error('Solo una cuenta de vendedor puede crear una tienda.');
    if (state.stores.some(store => store.ownerId === state.user.id)) throw new Error('Ya tienes una tienda. Puedes gestionarla desde tu perfil.');
    const area = neighborhoods.find(item => item.name === input.neighborhood) || neighborhoods[0];
    const store = { id: `local-${crypto.randomUUID()}`, ownerId: state.user.id,
      name: input.name.trim(), category: input.category, categoryIcon: categoryIcons[input.category], type: input.category,
      description: input.description.trim(), address: input.address.trim(), area: `${area.name}, Medellín`, city: 'Medellín',
      lat: area.lat, lng: area.lng, distance: 'En tu ciudad', rating: 0, reviews: 0, price: 0, offer: 'Nueva tienda',
      logo: input.logo || defaultStoreLogo(input.name), cover: input.cover || seedShops.find(shop => shop.category === input.category)?.cover || '/assets/medellin-colores.png', products: [] };
    save({ ...state, stores: [...state.stores, store] }); return copy(store);
  },
  async updateStore(id, input) {
    await wait();
    const current = state.stores.find(store => String(store.id) === String(id));
    if (state.user?.role !== 'seller' || !current || current.ownerId !== state.user.id) throw new Error('Solo puedes modificar tu propia tienda.');
    const area = neighborhoods.find(item => item.name === input.neighborhood) || neighborhoods[0];
    const store = { ...current, name: input.name.trim(), category: input.category, categoryIcon: categoryIcons[input.category], type: input.category,
      description: input.description.trim(), address: input.address.trim(), neighborhood: area.name, area: `${area.name}, Medellín`, lat: area.lat, lng: area.lng,
      logo: input.logo || current.logo, cover: input.cover || current.cover };
    save({ ...state, stores: state.stores.map(item => item.id === current.id ? store : item) }); return copy(store);
  },
  async getPurchases() { await wait(); if (state.user?.role !== 'buyer') throw new Error('Solo los compradores pueden ver sus compras.'); return copy({ payments: state.wallets[walletKey()]?.payments || [] }); },
  async connectPaymentWallet({ address }) {
    await wait(); if (state.user?.role !== 'buyer') throw new Error('Solo los compradores pueden conectar una wallet.');
    const paymentWallet = { address: normalizeWalletAddress(address), currency: 'USD', provider: 'Wallet externa', status: 'demo' };
    const user = { ...state.user, paymentWallet };
    save({ ...state, user, accounts: [...state.accounts.filter(account => account.id !== user.id), user] });
    return copy(user);
  },
  async createPaymentQuote({ shopId, items }) {
    await wait(); if (state.user?.role !== 'buyer' || !state.user.paymentWallet) throw new Error('Conecta una wallet en tu cuenta de comprador para cotizar.');
    const shop = catalog().find(store => store.id === shopId);
    if (!shop || !Array.isArray(items) || !items.length) throw new Error('Tu carrito está vacío o la tienda no está disponible.');
    const lines = items.map(item => {
      const product = shop.products.find(product => product.id === item.productId);
      if (!product || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) throw new Error('Revisa los productos y cantidades de tu carrito.');
      return { productId: product.id, name: product.name, quantity: item.quantity, unitPrice: product.price };
    });
    const receiveAmount = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
    if (!Number.isFinite(receiveAmount) || receiveAmount <= 0) throw new Error('El total debe ser mayor que cero.');
    const quote = { id: crypto.randomUUID(), userId: state.user.id, shopId, items: lines, walletAddress: state.user.paymentWallet.address,
      debitAmount: Math.round(receiveAmount / REFERENCE_RATE * 100) / 100, debitCurrency: 'USD', receiveAmount, receiveCurrency: 'COP',
      rate: REFERENCE_RATE, feeAmount: 0, expiresAt: new Date(Date.now() + 120000).toISOString(), mode: 'mock' };
    quotes.set(quote.id, quote); return copy(quote);
  },
  async pay({ quoteId, note }) {
    await wait(); if (state.user?.role !== 'buyer') throw new Error('Usa una cuenta de comprador para pagar.');
    const quote = quotes.get(quoteId);
    if (!quote || quote.userId !== state.user.id || quote.walletAddress !== state.user.paymentWallet?.address) throw new Error('Solicita una nueva cotización para tu wallet.');
    if (paidQuotes.has(quoteId)) return copy(paidQuotes.get(quoteId));
    if (Date.parse(quote.expiresAt) <= Date.now()) throw new Error('La cotización venció. Actualízala antes de continuar.');
    const key = walletKey(); const history = state.wallets[key] || initialWallet();
    const payment = { id: crypto.randomUUID(), quoteId, shopId: quote.shopId, amount: quote.receiveAmount, debit: quote.debitAmount,
      debitCurrency: quote.debitCurrency, receiveCurrency: quote.receiveCurrency, walletAddress: quote.walletAddress, items: quote.items, note, date: new Date().toISOString(), mode: 'mock', status: 'completed' };
    save({ ...state, wallets: { ...state.wallets, [key]: { payments: [payment, ...(history.payments || [])] } } });
    paidQuotes.set(quoteId, payment); return copy(payment);
  },
};
