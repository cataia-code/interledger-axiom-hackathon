import { ApiError, DATA_SOURCE, request } from '../api/client';
import { clearSessionToken, getSessionRole, getSessionToken, setSessionRole, setSessionToken } from '../api/sessionToken';
import { mockRepository } from '../api/mockRepository';
export function normalizeUser(user) {
  if (!user?.id || !['buyer', 'seller'].includes(user.role)) throw new ApiError('La cuenta recibida no coincide con el contrato de la API.', { code: 'INVALID_RESPONSE' });
  return { ...user, id: String(user.id), capabilities: user.role === 'seller' ? ['sell'] : ['buy'] };
}
async function getSession() {
  if (!getSessionToken()) return null;
  try { const user = normalizeUser((await request('/me')).user); setSessionRole(user.role); return user; }
  catch (error) { if (error.status === 401) return null; throw error; }
}
async function acceptSession(result, registered = false) {
  const user = normalizeUser(result.user); setSessionToken(result.token); setSessionRole(user.role);
  try {
    const profile = await getSession();
    if (!profile) throw new ApiError('Tu sesión no es válida. Inicia sesión nuevamente.', { code: 'UNAUTHORIZED', status: 401 });
    return profile;
  } catch (error) {
    if (registered && error.status !== 401) throw new ApiError('Tu cuenta se creó, pero no pudimos cargar tu perfil. Inicia sesión para continuar.', { code: 'PROFILE_LOAD_FAILED' });
    throw error;
  }
}
async function signIn(credentials, otp = false) {
  const firstRole = getSessionRole() || 'buyer';
  const path = role => `/auth/${role}/sign-in${otp ? '/otp' : ''}`;
  let result;
  try { result = await request(path(firstRole), { method: 'POST', body: credentials, auth: false }); }
  catch (error) {
    // Only an explicit role mismatch justifies trying the other auth endpoint.
    if (error.status !== 403 || error.code !== 'WRONG_ROLE') throw error;
    result = await request(path(firstRole === 'buyer' ? 'seller' : 'buyer'), { method: 'POST', body: credentials, auth: false });
  }
  return acceptSession(result);
}
async function register(values) {
  const role = values.initialIntent === 'sell' ? 'seller' : 'buyer';
  if (role === 'seller' && (!values.organization || !values.store)) throw new ApiError('El registro de vendedor requiere los datos legales de la organización y de la sucursal.', { code: 'SELLER_ONBOARDING_REQUIRED' });
  const body = { email: values.email.trim(), password: values.password, name: values.name.trim(),
    ...(role === 'seller' ? { country: values.country, dateOfBirth: values.dateOfBirth, documentType: values.documentType, organization: values.organization, store: values.store } : {}) };
  return acceptSession(await request(`/auth/${role}/sign-up`, { method: 'POST', body, auth: false }), true);
}
const http = {
  getSession,
  login: ({ email, password }) => signIn({ email: email.trim(), password }),
  loginWithOTP: ({ email, otp }) => signIn({ email: email.trim(), otp }, true),
  register,
  sendVerificationOTP: ({ email, type }) => request('/auth/email-otp/send-verification-otp', { method: 'POST', body: { email: email.trim(), type }, auth: false }),
  verifyEmail: ({ email, otp }) => request('/auth/email-otp/verify-email', { method: 'POST', body: { email: email.trim(), otp }, auth: false }),
  async logout() { try { if (getSessionToken()) await request('/auth/sign-out', { method: 'POST', body: {} }); } finally { clearSessionToken(); } },
  async updateProfile(values) { return normalizeUser((await request('/me', { method: 'PATCH', body: values })).user); },
};
export const authService = DATA_SOURCE === 'api' ? http : mockRepository;
