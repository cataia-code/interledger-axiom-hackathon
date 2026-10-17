const KEY = 'lokora:api:session-token';
const ROLE_KEY = 'lokora:api:session-role';
let memoryToken = null;
let memoryRole = null;
export function getSessionToken() {
  try { return memoryToken || sessionStorage.getItem(KEY); } catch { return memoryToken; }
}
export function getSessionRole() {
  let role;
  try { role = memoryRole || sessionStorage.getItem(ROLE_KEY); } catch { role = memoryRole; }
  return ['buyer', 'seller'].includes(role) ? role : null;
}
export function setSessionRole(role) {
  if (!['buyer', 'seller'].includes(role)) throw new Error('La API devolvió un rol inválido.');
  memoryRole = role;
  try { sessionStorage.setItem(ROLE_KEY, role); } catch { /* Session remains in memory. */ }
}
export function setSessionToken(token) {
  if (typeof token !== 'string' || !token) throw new Error('La API no devolvió un token de sesión válido.');
  memoryToken = token;
  try { sessionStorage.setItem(KEY, token); } catch { /* Session remains in memory. */ }
}
export function clearSessionToken() {
  memoryToken = null; memoryRole = null;
  try { sessionStorage.removeItem(KEY); sessionStorage.removeItem(ROLE_KEY); } catch { /* Storage can be disabled. */ }
}
