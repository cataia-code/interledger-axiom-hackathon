import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { ApiError, DATA_SOURCE } from '../services/api/client';
import { cartService } from '../services/cart/cartService';
import { minorToMajor } from '../services/marketplace/itemAdapter';
import { changeQuantity, groupCart } from '../lib/cart';
import { couponMessage } from '../lib/coupons';
const CartContext = createContext(null);
const OTHER_STORE_MESSAGE = 'Tu carrito contiene otra tienda. Finaliza esa compra o vacíalo antes de cambiar de comercio.';
const containsOtherStore = (items, shopId) => items.some(item => String(item.shopId) !== String(shopId));
function cartItems(result) {
  const cart = result.cart || result;
  return (cart.lines || []).flatMap(line => Array.from({ length: line.quantity }, () => ({
    id: String(line.itemId), shopId: String(cart.storeId), name: line.name, price: minorToMajor(line.unitAmount, cart.currency),
    currency: cart.currency, purchasable: line.purchasable, available: line.available,
  })));
}
export function CartProvider({ children }) {
  const { user } = useAuth();
  const [cart, setCart] = useState([]);
  const [cartDetails, setCartDetails] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartError, setCartError] = useState('');
  const [cartPending, setCartPending] = useState(false);
  const queue = useRef(Promise.resolve());
  const currentCart = useRef([]);
  const owner = useRef(user?.id); owner.current = user?.id;
  const replace = useCallback((items, details = null) => { currentCart.current = items; setCart(items); setCartDetails(details); }, []);
  const refreshCart = useCallback(async () => {
    if (DATA_SOURCE !== 'api' || user?.role !== 'buyer') return;
    const id = user.id; const result = await cartService.get();
    if (owner.current === id) replace(cartItems(result), result.cart || result);
  }, [user?.id, user?.role, replace]);
  useEffect(() => {
    let active = true; replace([]); setCartOpen(false); setCartError(''); setCartPending(false);
    if (DATA_SOURCE === 'api' && user?.role === 'buyer') {
      setCartPending(true);
      const initial = refreshCart().catch(error => { if (active) setCartError(error.message); }).finally(() => { if (active) setCartPending(false); });
      queue.current = initial;
    }
    return () => { active = false; };
  }, [user?.id, user?.role, refreshCart, replace]);
  const mutate = useCallback(operation => {
    const id = user?.id;
    const next = queue.current.then(async () => {
      if (!id || owner.current !== id || user.role !== 'buyer') return false;
      setCartPending(true); setCartError('');
      try { await operation(); await refreshCart(); return true; }
      catch (error) { if (owner.current === id) setCartError(error.code === 'CART_OTHER_STORE' ? OTHER_STORE_MESSAGE : couponMessage(error.code, error.message)); return false; }
      finally { if (owner.current === id) setCartPending(false); }
    });
    queue.current = next.catch(() => {}); return next;
  }, [user, refreshCart]);
  const cartGroups = useMemo(() => groupCart(cart).map(group => {
    if (DATA_SOURCE !== 'api' || !cartDetails || String(cartDetails.storeId) !== String(group.shopId)) return group;
    return { ...group, total: minorToMajor(cartDetails.totalAmount, cartDetails.currency), coupon: cartDetails.coupon || null,
      couponDiscountAmount: minorToMajor(cartDetails.couponDiscountAmount || 0, cartDetails.currency), couponError: cartDetails.couponError || null };
  }), [cart, cartDetails]);
  const applyCoupon = useCallback(values => mutate(() => cartService.applyCoupon(values)), [mutate]);
  const removeCoupon = useCallback(() => mutate(() => cartService.removeCoupon()), [mutate]);
  const addToCart = useCallback((shop, product) => {
    if (DATA_SOURCE === 'api') return mutate(() => {
      // Check inside the mutation queue so rapid clicks across stores cannot mix carts.
      if (containsOtherStore(currentCart.current, shop.id)) throw new ApiError(OTHER_STORE_MESSAGE, { code: 'CART_OTHER_STORE' });
      return cartService.setQuantity(product.id, currentCart.current.filter(item => item.id === String(product.id)).length + 1);
    });
    if (containsOtherStore(currentCart.current, shop.id)) { setCartError(OTHER_STORE_MESSAGE); return false; }
    setCartError(''); replace([...currentCart.current, { ...product, shopId: shop.id }]); return true;
  }, [mutate, replace]);
  const updateQuantity = useCallback((shopId, productId, quantity) => {
    if (DATA_SOURCE === 'api') return mutate(() => quantity > 0 ? cartService.setQuantity(productId, quantity) : cartService.removeItem(productId));
    setCartError(''); replace(changeQuantity(currentCart.current, shopId, productId, quantity));
  }, [mutate, replace]);
  const consumeCartItems = useCallback((shopId, lines) => {
    const remaining = new Map(lines.map(line => [line.productId, line.quantity]));
    replace(currentCart.current.filter(item => { if (item.shopId !== shopId || !remaining.get(item.id)) return true; remaining.set(item.id, remaining.get(item.id) - 1); return false; }));
  }, [replace]);
  const clearShopCart = useCallback(shopId => {
    if (DATA_SOURCE === 'api') return mutate(() => cartService.clear());
    setCartError(''); replace(currentCart.current.filter(item => item.shopId !== shopId)); return true;
  }, [mutate, replace]);
  const openCart = useCallback(() => setCartOpen(true), []);
  const closeCart = useCallback(() => setCartOpen(false), []);
  return <CartContext.Provider value={{ cart, cartDetails, cartGroups, cartCount: cart.length, cartOpen, cartError, cartPending, refreshCart, addToCart, updateQuantity, clearShopCart, consumeCartItems, openCart, closeCart, applyCoupon, removeCoupon }}>{children}</CartContext.Provider>;
}
export function useCart() { return useContext(CartContext); }
