export const PAYMENT_RETURN_CHANNEL = 'lokora:payment-return';
export const PAYMENT_POPUP_KEY = 'lokora:payment-popup';

export function readPaymentReturn() {
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get('order');
  // Return parameters identify a purchase only. They are never proof of payment.
  return params.has('payment') && /^[1-9]\d*$/.test(orderId || '') ? { orderId } : null;
}

export function paymentReturnPath(orderId) {
  const url = new URL(window.location.href);
  url.searchParams.delete('payment'); url.searchParams.delete('order');
  url.hash = `paymentReturn/${orderId}`;
  return url.pathname + url.search + url.hash;
}
