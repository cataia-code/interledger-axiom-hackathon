import { DATA_SOURCE, request } from '../api/client';
import { mockRepository } from '../api/mockRepository';
const http = {
  getSession: () => request('/auth/me'),
  login: credentials => request('/auth/login', { method: 'POST', body: credentials }),
  register: account => request('/auth/register', { method: 'POST', body: account }),
  logout: () => request('/auth/logout', { method: 'POST' }),
};
export const authService = DATA_SOURCE === 'api' ? http : mockRepository;
