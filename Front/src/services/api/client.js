import { clearSessionToken, getSessionToken } from './sessionToken';
export const DATA_SOURCE = import.meta.env.VITE_DATA_SOURCE || 'api';
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');
export class ApiError extends Error {
  constructor(message, { status = 0, code = 'REQUEST_FAILED', retryAfter = 0 } = {}) {
    super(message); this.name = 'ApiError'; this.status = status; this.code = code; this.retryAfter = retryAfter;
  }
}
export async function request(path, { method = 'GET', body, signal, headers = {}, auth = true, idempotencyKey } = {}) {
  const token = auth ? getSessionToken() : null;
  const multipart = typeof FormData !== 'undefined' && body instanceof FormData;
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method, credentials: 'omit', signal,
      headers: { Accept: 'application/json', ...(body !== undefined && !multipart ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}), ...headers },
      body: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
    });
  } catch (cause) {
    if (cause.name === 'AbortError') throw cause;
    throw new ApiError('No pudimos conectar con el servidor de Lokora o Axiom API. Comprueba que Node esté activo.', { code: 'NETWORK_ERROR' });
  }
  if (response.status === 204) return null;
  const content = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && auth) {
      clearSessionToken(); window.dispatchEvent(new Event('lokora:session-expired'));
    }
    const error = content?.error || content;
    throw new ApiError(error?.message || 'No pudimos completar la solicitud.', { status: response.status, code: error?.code || `HTTP_${response.status}`, retryAfter: Math.min(600, Math.max(0, Number(response.headers.get('Retry-After')) || 0)) });
  }
  if (content === null) throw new ApiError('La API devolvió una respuesta JSON inválida.', { status: response.status, code: 'INVALID_RESPONSE' });
  return content?.data ?? content;
}
export function queryPath(path, query = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  return params.size ? `${path}?${params}` : path;
}
// Read all cursor pages without silently limiting the catalog to the first page.
export async function collectPages(path, field, query = {}, options = {}) {
  const rows = []; const seen = new Set(); let cursor;
  do {
    const page = await request(queryPath(path, { ...query, limit: query.limit || 50, cursor }), options);
    if (!Array.isArray(page?.[field])) throw new ApiError('La lista recibida no coincide con el contrato de la API.', { code: 'INVALID_RESPONSE' });
    rows.push(...page[field]); cursor = page.nextCursor;
    if (cursor != null) {
      if (seen.has(String(cursor))) throw new ApiError('La API repitió un cursor de paginación.', { code: 'INVALID_CURSOR' });
      seen.add(String(cursor));
    }
  } while (cursor != null);
  return rows;
}
export function resolveImageURL(value) {
  if (!value) return '';
  try {
    const base = new URL(import.meta.env.VITE_API_ASSET_ORIGIN || API_BASE_URL, window.location.origin);
    const url = new URL(value, base.origin);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}
