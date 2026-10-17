import { ApiError, DATA_SOURCE } from '../api/client';
import { mockRepository } from '../api/mockRepository';
import { orderService } from '../orders/orderService';
import { minorToMajor } from '../marketplace/itemAdapter';
const unsupported = async () => { throw new ApiError('Esta API aún no ofrece conexión de wallet ni cotización USD/COP. El pago disponible es por pedido y usa un proveedor placeholder.', { code: 'OPEN_PAYMENTS_NOT_AVAILABLE' }); };
const http = {
  async getPurchases() {
    const orders = await orderService.listAll();
    const attempts = new Map();
    // Only pending orders need payment-attempt detail to distinguish an
    // abandoned authorization from an explicit provider failure.
    const pending = orders.filter(order => order.status === 'pending_payment');
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(3, pending.length) }, async () => {
      while (cursor < pending.length) {
        const order = pending[cursor++];
        try {
          const result = await orderService.payments(order.id);
          const latest = [...(result?.payments || [])].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || Number(b.id) - Number(a.id))[0];
          attempts.set(String(order.id), { latest, unavailable: false });
        } catch (cause) { if (cause.status === 401) throw cause; attempts.set(String(order.id), { unavailable: true }); }
      }
    }));
    return { payments: orders.map(order => ({
      id: String(order.id), orderId: String(order.id), shopId: String(order.storeId), amount: minorToMajor(order.totalAmount, order.currency),
      number: order.number, currency: order.currency, date: order.createdAt, expiresAt: order.expiresAt, status: order.status, mode: 'api',
      paymentStatus: attempts.get(String(order.id))?.latest?.status || null,
      paymentDetailsUnavailable: attempts.get(String(order.id))?.unavailable || false,
      // This contract does not provide the buyer's debit currency or an FX quote.
      debit: null,
    })) };
  },
  connectPaymentWallet: unsupported,
  createPaymentQuote: unsupported,
  pay: unsupported,
};
export const paymentService = DATA_SOURCE === 'api' ? http : mockRepository;
