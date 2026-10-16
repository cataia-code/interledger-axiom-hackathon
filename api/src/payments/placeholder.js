import { randomUUID, timingSafeEqual } from 'node:crypto';
import { config } from '../config/index.js';
import { HttpError } from '../middlewares/errorHandler.js';

// Proveedor de pago simulado: el cobro se "confirma" con un webhook propio protegido por un secreto.
// Cuando se elija un proveedor real, solo hay que implementar esta misma interfaz en otro archivo.
export const placeholder = {
  name: 'placeholder',

  async createPayment() {
    return { providerRef: `ph_${randomUUID()}` };
  },

  async refund() {
    return { providerRef: `phr_${randomUUID()}` };
  },

  // Valida el secreto y devuelve el evento normalizado { eventId, type, providerRef }.
  verifyWebhook(headers, body) {
    const secret = config.paymentWebhookSecret;
    const received = String(headers['x-webhook-secret'] ?? '');
    const ok = secret && received.length === secret.length && timingSafeEqual(Buffer.from(received), Buffer.from(secret));
    if (!ok) throw new HttpError(401, 'Invalid webhook secret', 'INVALID_WEBHOOK_SIGNATURE');
    const { eventId, type, providerRef } = body ?? {};
    const types = ['payment.captured', 'payment.failed'];
    if (typeof eventId !== 'string' || !eventId || typeof providerRef !== 'string' || !types.includes(type)) {
      throw new HttpError(400, 'Invalid event', 'INVALID_WEBHOOK_EVENT');
    }
    return { eventId, type, providerRef };
  },
};
