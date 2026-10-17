import { collectPages, request } from '../api/client';
export const couponService = {
  list: (query = {}, options = {}) => collectPages('/coupons', 'coupons', query, options),
  claim: id => request(`/coupons/${encodeURIComponent(id)}/claim`, { method: 'POST', body: {} }),
};
const sellerCouponPath = id => `/seller/coupons/${encodeURIComponent(id)}`;
export const sellerCouponService = {
  list: (query = {}, options = {}) => collectPages('/seller/coupons', 'coupons', query, options),
  get: (id, options = {}) => request(sellerCouponPath(id), options),
  create: body => request('/seller/coupons', { method: 'POST', body }),
  update: (id, body) => request(sellerCouponPath(id), { method: 'PATCH', body }),
  remove: id => request(sellerCouponPath(id), { method: 'DELETE' }),
  assign: (id, emails) => request(`${sellerCouponPath(id)}/assign`, { method: 'POST', body: { emails } }),
  redemptions: (id, query = {}, options = {}) => collectPages(`${sellerCouponPath(id)}/redemptions`, 'redemptions', query, options),
};
