import { ApiError, collectPages, queryPath, request } from '../api/client';
const orderPath = id => `/orders/${encodeURIComponent(id)}`;
function requireAttemptKey(key) {
  if (typeof key !== 'string' || !/^[A-Za-z0-9_.:-]{8,80}$/.test(key)) throw new ApiError('Falta la clave del intento. Conserva la misma clave al reintentar.', { code: 'IDEMPOTENCY_KEY_REQUIRED' });
  return key;
}
export const orderService = {
  newAttemptKey: () => crypto.randomUUID(),
  create: idempotencyKey => request('/orders', { method: 'POST', idempotencyKey: requireAttemptKey(idempotencyKey) }),
  list: (query = {}, options = {}) => request(queryPath('/orders', query), options),
  listAll: (query = {}, options = {}) => collectPages('/orders', 'orders', query, options),
  get: (id, options = {}) => request(orderPath(id), options),
  cancel: id => request(`${orderPath(id)}/cancel`, { method: 'POST', body: {} }),
  pay: (id, idempotencyKey) => request(`${orderPath(id)}/pay`, { method: 'POST', body: {}, idempotencyKey: requireAttemptKey(idempotencyKey) }),
  payments: (id, options = {}) => request(`${orderPath(id)}/payments`, options),
};
