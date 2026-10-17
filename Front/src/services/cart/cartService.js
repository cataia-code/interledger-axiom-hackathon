import { request } from '../api/client';
const itemPath = itemId => `/cart/items/${encodeURIComponent(itemId)}`;
// Server cart is authoritative, belongs to one store, and uses minor-unit amounts.
export const cartService = {
  get: options => request('/cart', options),
  setQuantity: (itemId, quantity) => request(itemPath(itemId), { method: 'PUT', body: { quantity } }),
  removeItem: itemId => request(itemPath(itemId), { method: 'DELETE' }),
  clear: () => request('/cart', { method: 'DELETE' }),
  applyCoupon: body => request('/cart/coupon', { method: 'PUT', body }),
  removeCoupon: () => request('/cart/coupon', { method: 'DELETE' }),
};
