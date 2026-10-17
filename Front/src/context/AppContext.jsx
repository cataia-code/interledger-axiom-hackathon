import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useHashNavigation } from '../hooks/useHashNavigation';
import { useStores } from '../hooks/useStores';
import { useCart } from './CartContext';
import { useAuth } from './AuthContext';
import { minorToMajor } from '../services/marketplace/itemAdapter';
import { DATA_SOURCE } from '../services/api/client';
import { paymentService } from '../services/payments/paymentService';
import { PAYMENT_RETURN_CHANNEL } from '../lib/paymentReturnBridge';

const AppContext = createContext(null);
export function AppProvider({ children }) {
  const navigation = useHashNavigation();
  const auth = useAuth();
  const catalog = useStores(auth.user?.id, auth.user?.role);
  const [selectedShopId, setSelectedShopId] = useState(navigation.param || 'craft');
  const [homeFilters, setHomeFilters] = useState({ query: '', category: 'Todas' });
  const [favorites, setFavorites] = useState([]);
  const shopping = useCart();
  const [checkoutShopId, setCheckoutShopId] = useState(null);
  const [lastPayment, setLastPayment] = useState(null);
  const [activeCoupons, setActiveCoupons] = useState([]);
  const [toast, setToast] = useState('');
  const [dialog, setDialog] = useState(null);
  const [amount, setAmount] = useState(25000);
  const [purchaseHistory, setPurchaseHistory] = useState(null);
  const [paymentPending, setPaymentPending] = useState(false);
  const [authIntent, setAuthIntent] = useState('buy');
  const [authReturnTo, setAuthReturnTo] = useState('home');
  const [schedule, setSchedule] = useState({ enabled: true, frequency: 'Mensual', minimum: 50 });
  const toastTimer = useRef(null);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const [purchasesError, setPurchasesError] = useState('');
  const [purchasesRefreshing, setPurchasesRefreshing] = useState(false);
  const purchaseOwner = useRef(auth.user?.id); purchaseOwner.current = auth.user?.id;
  const purchaseRequest = useRef(0);
  const refreshPurchases = useCallback(async () => {
    if (auth.user?.role !== 'buyer') return;
    const ownerId = auth.user.id, requestId = ++purchaseRequest.current;
    setPurchasesRefreshing(true); setPurchasesError('');
    try { const result = await paymentService.getPurchases(); if (purchaseOwner.current === ownerId && purchaseRequest.current === requestId) setPurchaseHistory(result); }
    catch (cause) { if (purchaseOwner.current === ownerId && purchaseRequest.current === requestId) setPurchasesError(cause.message); }
    finally { if (purchaseOwner.current === ownerId && purchaseRequest.current === requestId) setPurchasesRefreshing(false); }
  }, [auth.user?.id, auth.user?.role]);
  useEffect(() => { setPurchaseHistory(null); setPurchasesError(''); if (auth.user?.role === 'buyer') refreshPurchases(); else { setPurchaseHistory({ payments: [] }); setPurchasesRefreshing(false); } }, [refreshPurchases]);
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined' || auth.user?.role !== 'buyer') return;
    const channel = new BroadcastChannel(PAYMENT_RETURN_CHANNEL);
    channel.onmessage = event => {
      if (event.data?.type !== 'return' || !/^\d+$/.test(String(event.data.orderId || '')) || typeof event.data.nonce !== 'string') return;
      let matches = String(lastPayment?.orderId || lastPayment?.id || '') === String(event.data.orderId);
      try {
        const attempt = JSON.parse(sessionStorage.getItem(`lokora:checkout:${auth.user.id}`) || 'null');
        matches ||= String(attempt?.orderId || '') === String(event.data.orderId);
      } catch { /* Missing local attempt is not payment confirmation. */ }
      if (!matches) return;
      channel.postMessage({ type: 'ack', orderId: String(event.data.orderId), nonce: event.data.nonce });
      window.dispatchEvent(new CustomEvent('lokora:payment-return', { detail: { orderId: String(event.data.orderId) } }));
      try { window.focus(); } catch { /* Browser may require a user gesture. */ }
    };
    return () => channel.close();
  }, [auth.user?.id, auth.user?.role, lastPayment?.orderId, lastPayment?.id]);
  useEffect(() => {
    setLastPayment(null); setCheckoutShopId(null); setFavorites([]); setActiveCoupons([]); setDialog(null); setToast('');
  }, [auth.user?.id]);
  const notify = useCallback(message => { clearTimeout(toastTimer.current); setToast(message); toastTimer.current = setTimeout(() => setToast(''), 2800); }, []);
  function openShop(id) { setSelectedShopId(id); navigation.navigate(`store/${id}`); }
  function openAccount(intent = 'buy', returnTo = 'home', page = 'login') { setAuthIntent(intent); setAuthReturnTo(returnTo); navigation.navigate(page); }
  const ownedShop = auth.user && catalog.shops.find(shop => shop.ownerId === auth.user.id);
  function createMyStore() { if (!auth.user) openAccount('sell', 'seller', 'register'); else if (auth.user.role !== 'seller') notify('La gestión de tiendas requiere una cuenta de vendedor.'); else navigation.navigate('createStore'); }
  function toggleFavorite(id) { setFavorites(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]); }
  async function addProduct(shop, product) { if (auth.user?.role !== 'buyer') { notify('Inicia sesión con una cuenta de comprador.'); return; } const added = await shopping.addToCart(shop, product); if (added === false) { shopping.openCart(); return; } setSelectedShopId(shop.id); notify(`${product.name} agregado al carrito`); }
  function beginCheckout(shop) {
    if (auth.user?.role !== 'buyer') { notify('El pago requiere una cuenta de comprador.'); return; }
    if (shopping.cartDetails?.couponError) { notify('Revisa o quita el cupón antes de continuar al pago.'); shopping.openCart(); return; }
    const group = shopping.cartGroups.find(item => item.shopId === shop.id);
    if (!group?.items.length) { notify('Agrega productos antes de pagar en la tienda.'); return; }
    setSelectedShopId(shop.id); setCheckoutShopId(shop.id); setAmount(group.total); shopping.closeCart(); navigation.navigate('payment');
  }
  function completeApiPayment(order, quote = null, captured = null) {
    const payment = { id: String(order.id), shopId: String(order.storeId), amount: quote?.receive?.value ?? minorToMajor(order.totalAmount, order.currency), currency: quote?.receive?.currency || order.currency, debit: quote?.debit?.value ?? null, debitCurrency: quote?.debit?.currency || null, fee: quote?.fee?.value ?? null, feeCurrency: quote?.fee?.currency || null, hasQuote: Boolean(quote), date: captured?.createdAt || order.createdAt, mode: 'api', status: captured?.status || order.status };
    setLastPayment(payment); setPurchaseHistory(current => ({ payments: [payment, ...(current?.payments || []).filter(item => item.id !== payment.id)] }));
    setCheckoutShopId(null); navigation.navigate('success');
  }
  async function confirmDemoPayment(note, quote) {
    if (!checkoutShopId) { notify('Inicia tu compra desde la tienda.'); return; }
    if (!auth.user) { openAccount('buy', 'payment'); return; }
    if (!quote || quote.shopId !== checkoutShopId || quote.userId !== auth.user.id || Date.parse(quote.expiresAt) <= Date.now()) { notify('Actualiza la cotización antes de pagar.'); return; }
    if (paymentPending) return;
    setPaymentPending(true);
    try {
      const receipt = await paymentService.pay({ quoteId: quote.id, note });
      if (DATA_SOURCE === 'api' && receipt.status !== 'completed') {
        notify('El pago aún necesita autorización o confirmación del proveedor.'); return;
      }
      setLastPayment(receipt);
      setPurchaseHistory(current => ({ payments: [receipt, ...(current?.payments || [])] }));
      shopping.consumeCartItems(quote.shopId, quote.items);
      setCheckoutShopId(null); navigation.navigate('success');
    }
    catch (error) { notify(error.message); }
    finally { setPaymentPending(false); }
  }
  return <AppContext.Provider value={{ ...navigation, ...auth, ...catalog,
    selectedShopId, setSelectedShopId, selectedShop: catalog.findShop(navigation.route === 'store' ? navigation.param || selectedShopId : selectedShopId),
    openShop, ownedShop, createMyStore, openAccount, authIntent, setAuthIntent, authReturnTo,
    homeFilters, setHomeFilters, favorites, toggleFavorite, ...shopping, addProduct, beginCheckout, checkoutShopId, lastPayment, completeApiPayment, activeCoupons, setActiveCoupons, toast, notify, dialog, setDialog,
    amount, setAmount, purchasesLoading: purchasesRefreshing || (!purchaseHistory && !purchasesError), purchasesError, refreshPurchases, payments: purchaseHistory?.payments || [], paymentPending, confirmDemoPayment, schedule, setSchedule,
  }}>{children}</AppContext.Provider>;
}
export function useApp() { const value = useContext(AppContext); if (!value) throw new Error('useApp debe usarse dentro de AppProvider'); return value; }
