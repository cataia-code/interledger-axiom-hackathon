import { getSellerContext } from '../services/sellerService.js';
import { config } from '../config/index.js';
import * as payments from '../services/paymentService.js';
import { renderPaymentResult } from '../views/paymentResult.js';

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
  async (req) => {
    const { created, ...rest } = await payments.startPayment(req.auth.user.id, req.params.id, req.get('Idempotency-Key'), req.body);
    return { ...rest, created };
  },
);
export const getMyPayments = handler(200, async (req) => ({ payments: await payments.buyerPayments(req.auth.user.id, req.params.id) }));
export const getStorePayments = handler(200, async (req) => ({ payments: await payments.storePayments(await storeId(req), req.params.id) }));
export const postRefund = handler(201, async (req) => payments.sellerRefund(await storeId(req), req.auth.user.id, req.params.id, req.body));
export const webhook = handler(200, (req) => payments.handleWebhook(req.headers, req.body));

// La wallet redirige aquí al navegador. Si pide HTML (un navegador) se responde una página de resultado que se cierra sola;
// para clientes de API se mantiene lo anterior: con FRONTEND_URL redirige al front y sin ella responde JSON.
const wantsHtml = (req) => (req.get('accept') ?? '').includes('text/html');

function sendResultPage(res, httpStatus, data) {
  const appUrl = config.frontendUrl ? new URL(config.frontendUrl) : null;
  if (appUrl && data.status !== 'error') {
    appUrl.searchParams.set('payment', data.status);
    appUrl.searchParams.set('order', String(data.orderId));
  }
  res
    .status(httpStatus)
    .set({
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      // Helmet lo pone en same-origin, y eso cortaría la relación con la ventana que abrió el pago.
      'Cross-Origin-Opener-Policy': 'unsafe-none',
    })
    .send(renderPaymentResult({ ...data, appUrl: appUrl?.toString() ?? null, appOrigin: appUrl?.origin ?? '' }));
}

export async function openPaymentsReturn(req, res, next) {
  try {
    const result = await payments.completeOpenPayment(req.params.orderId, req.query);
    if (wantsHtml(req)) {
      return sendResultPage(res, 200, { status: result.status, orderId: result.orderId, orderNumber: await payments.orderNumberOf(result.orderId) });
    }
    if (!config.frontendUrl) return res.status(200).json(result);
    const url = new URL(config.frontendUrl);
    url.searchParams.set('payment', result.status);
    url.searchParams.set('order', String(result.orderId));
    return res.redirect(302, url.toString());
  } catch (err) {
    if (!wantsHtml(req)) return next(err);
    if (!err.status) req.log?.error(err);
    return sendResultPage(res, err.status ?? 500, { status: 'error', code: err.code ?? null });
  }
}
