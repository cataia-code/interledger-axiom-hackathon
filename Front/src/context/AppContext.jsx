import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useHashNavigation } from '../hooks/useHashNavigation';
import { useStores } from '../hooks/useStores';
import { useAuth } from './AuthContext';
import { walletService } from '../services/wallet/walletService';

const AppContext = createContext(null);
export function AppProvider({ children }) {
  const navigation = useHashNavigation();
  const auth = useAuth();
  const catalog = useStores();
  const [selectedShopId, setSelectedShopId] = useState(navigation.param || 'craft');
  const [favorites, setFavorites] = useState([]);
  const [cart, setCart] = useState([]);
  const [activeCoupons, setActiveCoupons] = useState([]);
  const [toast, setToast] = useState('');
  const [dialog, setDialog] = useState(null);
  const [amount, setAmount] = useState(25000);
  const [wallet, setWallet] = useState(null);
  const [paymentPending, setPaymentPending] = useState(false);
  const [authIntent, setAuthIntent] = useState('buy');
  const [authReturnTo, setAuthReturnTo] = useState('home');
  const [schedule, setSchedule] = useState({ enabled: true, frequency: 'Mensual', minimum: 50 });
  const toastTimer = useRef(null);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  useEffect(() => { let active = true; setWallet(null); walletService.getWallet().then(result => { if (active) setWallet(result); }).catch(() => { if (active) setWallet({ balanceUSD: 0, payments: [] }); }); return () => { active = false; }; }, [auth.user?.id]);
  const notify = useCallback(message => { clearTimeout(toastTimer.current); setToast(message); toastTimer.current = setTimeout(() => setToast(''), 2800); }, []);
  function openShop(id) { setSelectedShopId(id); navigation.navigate(`store/${id}`); }
  function openAccount(intent = 'buy', returnTo = 'home', page = 'login') { setAuthIntent(intent); setAuthReturnTo(returnTo); navigation.navigate(page); }
  const ownedShop = auth.user && catalog.shops.find(shop => shop.ownerId === auth.user.id);
  function createMyStore() { if (!auth.user) openAccount('sell', 'createStore', 'register'); else navigation.navigate(ownedShop ? 'seller' : 'createStore'); }
  function toggleFavorite(id) { setFavorites(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]); }
  function addProduct(shop, product) { setCart(current => [...current, { ...product, shopId: shop.id }]); setSelectedShopId(shop.id); notify(`${product.name} agregado al carrito`); }
  async function confirmDemoPayment(note) {
    if (!auth.user) { openAccount('buy', 'payment'); return; }
    if (paymentPending) return;
    setPaymentPending(true);
    try { const nextWallet = await walletService.pay({ shopId: selectedShopId, amount, note }); setWallet(nextWallet); navigation.navigate('success'); }
    catch (error) { notify(error.message); }
    finally { setPaymentPending(false); }
  }
  return <AppContext.Provider value={{ ...navigation, ...auth, ...catalog,
    selectedShopId, setSelectedShopId, selectedShop: catalog.findShop(navigation.route === 'store' ? navigation.param || selectedShopId : selectedShopId),
    openShop, ownedShop, createMyStore, openAccount, authIntent, setAuthIntent, authReturnTo,
    favorites, toggleFavorite, cart, addProduct, activeCoupons, setActiveCoupons, toast, notify, dialog, setDialog,
    amount, setAmount, balanceUSD: wallet?.balanceUSD ?? 0, walletLoading: !wallet, payments: wallet?.payments || [], paymentPending, confirmDemoPayment, schedule, setSchedule,
  }}>{children}</AppContext.Provider>;
}
export function useApp() { const value = useContext(AppContext); if (!value) throw new Error('useApp debe usarse dentro de AppProvider'); return value; }
