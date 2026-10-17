import { getSellerContext } from '../services/sellerService.js';
import * as coupons from '../services/couponService.js';

const handler = (status, fn) => async (req, res, next) => {
  try {
    const body = await fn(req);
    if (body === undefined) res.status(204).end();
    else res.status(typeof status === 'function' ? status(body) : status).json(body);
  } catch (err) {
    next(err);
  }
};

const storeId = async (req) => (await getSellerContext(req.auth.user.id)).store.id;
const userId = (req) => Number(req.auth.user.id);

// ---- vendedor ----
export const postCoupon = handler(201, async (req) => ({ coupon: await coupons.createCoupon(await storeId(req), req.body) }));
export const listCoupons = handler(200, async (req) => coupons.listSellerCoupons(await storeId(req), req.query));
export const getCoupon = handler(200, async (req) => ({ coupon: await coupons.getSellerCoupon(await storeId(req), req.params.id) }));
export const patchCoupon = handler(200, async (req) => ({ coupon: await coupons.updateCoupon(await storeId(req), req.params.id, req.body) }));
export const removeCoupon = handler(204, async (req) => {
  await coupons.deleteCoupon(await storeId(req), req.params.id);
});
export const postAssign = handler(200, async (req) => coupons.assignCoupon(await storeId(req), req.params.id, req.body));
export const getRedemptions = handler(200, async (req) => coupons.listRedemptions(await storeId(req), req.params.id, req.query));

// ---- comprador ----
export const listMine = handler(200, (req) => coupons.listMyCoupons(userId(req), req.query));
export const postClaim = handler((body) => (body.created ? 201 : 200), (req) => coupons.claimCoupon(userId(req), req.params.id));
export const putCartCoupon = handler(200, async (req) => ({ cart: await coupons.applyCouponToCart(userId(req), req.body) }));
export const deleteCartCoupon = handler(200, async (req) => ({ cart: await coupons.removeCartCoupon(userId(req)) }));
