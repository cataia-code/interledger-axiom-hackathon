export const DATA_SOURCE = import.meta.env.VITE_DATA_SOURCE || 'mock';
const baseURL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

export async function request(path, { method = 'GET', body, signal } = {}) {
  const response = await fetch(`${baseURL}${path}`, {
    method, credentials: 'include', signal,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const content = await response.json().catch(() => null);
  if (!response.ok) throw new Error(content?.message || 'No pudimos completar la solicitud. Intenta de nuevo.');
  return content?.data ?? content;
}
