// Backend integration helper. Call only AFTER the Open Payments callback has
// been verified and its result persisted. This does not authorize a payment.
export function redirectPaymentReturn(response, orderId, frontendUrl = process.env.FRONTEND_APP_URL) {
  if (!/^[1-9]\d*$/.test(String(orderId))) throw new Error('Invalid order id');
  const target = new URL(frontendUrl);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname);
  if ((target.protocol !== 'https:' && !(local && target.protocol === 'http:')) || target.username || target.password || target.search || target.hash) throw new Error('FRONTEND_APP_URL must be a configured HTTPS app URL (or local development URL), without credentials, query or hash');
  // Never use a URL supplied by the buyer or wallet provider as an open redirect.
  target.hash = `paymentReturn/${orderId}`;
  response.writeHead(303, { Location: target.href, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
  response.end();
}
