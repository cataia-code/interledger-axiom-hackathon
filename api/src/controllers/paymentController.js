import { getSellerContext } from '../services/sellerService.js';
import * as payments from '../services/paymentService.js';

const handler = (status, fn) => async (req, res, next) => {
  try {
    const body = await fn(req);
    res.status(typeof status === 'function' ? status(body) : status).json(body);
  } catch (err) {
    next(err);
  }
};
const storeId = async (req) => (await getSellerContext(req.auth.user.id)).store.id;

export const postPayment = handler(
  (body) => (body.created ? 201 : 200),
  (req) => payments.startPayment(req.auth.user.id, req.params.id, req.get('Idempotency-Key')),
);
export const getMyPayments = handler(200, async (req) => ({ payments: await payments.buyerPayments(req.auth.user.id, req.params.id) }));
export const getStorePayments = handler(200, async (req) => ({ payments: await payments.storePayments(await storeId(req), req.params.id) }));
export const postRefund = handler(201, async (req) => payments.sellerRefund(await storeId(req), req.auth.user.id, req.params.id, req.body));
export const webhook = handler(200, (req) => payments.handleWebhook(req.headers, req.body));
