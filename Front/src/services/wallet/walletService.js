import { DATA_SOURCE, request } from '../api/client';
import { mockRepository } from '../api/mockRepository';
const http = {
  getWallet: () => request('/wallet'),
  pay: payment => request('/payments', { method: 'POST', body: { ...payment, currency: 'COP' } }),
};
export const walletService = DATA_SOURCE === 'api' ? http : mockRepository;
