import { getSellerContext } from '../services/sellerService.js';
import * as cart from '../services/cartService.js';
import * as orders from '../services/orderService.js';

const handler = (status, fn) => async (req, res, next) => {
  try {
    const body = await fn(req, res);
    if (body === undefined) res.status(204).end();
    else res.status(typeof status === 'function' ? status(body) : status).json(body);
  } catch (err) {
    next(err);
  }
};

const storeId = async (req) => (await getSellerContext(req.auth.user.id)).store.id;

// ---- buyer: carrito ----
export const getCart = handler(200, async (req) => ({ cart: await cart.viewCart(Number(req.auth.user.id)) }));
export const putCartItem = handler(200, async (req) => ({
  cart: await cart.setCartItem(Number(req.auth.user.id), req.params.itemId, req.body?.quantity),
}));
export const deleteCartItem = handler(200, async (req) => ({ cart: await cart.removeCartItem(Number(req.auth.user.id), req.params.itemId) }));
export const deleteCart = handler(204, async (req) => {
  await cart.clearCart(Number(req.auth.user.id));
});

// ---- buyer: pedidos ----
export const postOrder = handler(
  (body) => (body.created ? 201 : 200),
  async (req) => {
    const { order, created } = await orders.checkout(req.auth.user.id, req.get('Idempotency-Key'));
    return { order, created };
  },
);
export const listMyOrders = handler(200, (req) => orders.listBuyerOrders(req.auth.user.id, req.query));
export const getMyOrder = handler(200, async (req) => ({ order: await orders.getBuyerOrder(req.auth.user.id, req.params.id) }));
export const cancelMyOrder = handler(200, async (req) => ({ order: await orders.buyerCancel(req.auth.user.id, req.params.id) }));

// ---- seller: pedidos ----
export const listSellerOrders = handler(200, async (req) => orders.listStoreOrders(await storeId(req), req.query));
export const getSellerOrder = handler(200, async (req) => ({ order: await orders.getStoreOrder(await storeId(req), req.params.id) }));
export const postSellerTransition = handler(200, async (req) => ({
  order: await orders.sellerTransition(await storeId(req), req.auth.user.id, req.params.id, req.body),
}));
