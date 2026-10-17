import { eq } from 'drizzle-orm';
import { APIError } from 'better-auth/api';
import { auth } from '../auth/index.js';
import { db } from '../db/index.js';
import { session, user } from '../db/schema.js';
import { HttpError } from '../middlewares/errorHandler.js';
import { validateOrganizationInput, validateStoreInput } from './storeService.js';
import { countryCode } from './validation.js';
import { createSellerOrganization, presentOrganization, presentStore, sellerStatus } from './sellerService.js';

// Traduce los errores de Better Auth al formato de errores de la API.
async function callAuth(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof APIError) {
      throw new HttpError(err.statusCode, err.body?.message ?? err.message, err.body?.code ?? 'AUTH_ERROR');
    }
    throw err;
  }
}

const publicUser = ({ id, email, name, role, emailVerified, country }) => ({ id: Number(id), email, name, role, emailVerified, country: country ?? null });

// country es opcional al registrarse; si viene, debe ser un código ISO válido.
const optionalCountry = (value) => (value == null || value === '' ? null : countryCode(value, 'country'));

// Better Auth no deja que el cliente fije campos propios, así que el país se guarda después de crear la cuenta.
async function saveCountry(userId, country) {
  if (country) await db.update(user).set({ country }).where(eq(user.id, Number(userId)));
}

async function revokeSession(token) {
  await db.delete(session).where(eq(session.token, token));
}

// Cada login solo acepta su rol. Se comprueba después de autenticar, para no revelar
// qué correos existen; si el rol no coincide, la sesión recién creada se revoca.
async function enforceRole(result, role) {
  if (result.user.role !== role) {
    await revokeSession(result.token);
    throw new HttpError(403, `This account is a ${result.user.role}; use the ${result.user.role} login`, 'WRONG_ROLE');
  }
  if (role === 'seller') {
    const status = await sellerStatus(result.user.id);
    if (!status.organization || !status.store) {
      await revokeSession(result.token);
      throw status.organization
        ? new HttpError(403, 'A seller must have a store', 'STORE_REQUIRED')
        : new HttpError(403, 'A seller must have an organization', 'ORGANIZATION_REQUIRED');
    }
  }
  return { token: result.token, user: publicUser(result.user) };
}

export async function signUpBuyer({ email, password, name, country }) {
  const countryInput = optionalCountry(country);
  const result = await callAuth(() => auth.api.signUpEmail({ body: { email, password, name } }));
  await saveCountry(result.user.id, countryInput);
  return { token: result.token, user: publicUser({ ...result.user, country: countryInput }) };
}

// Crea usuario, organización y primera sucursal juntos: nunca queda un seller sin ellas.
export async function signUpSeller({ email, password, name, country, organization: orgBody, store: storeBody }) {
  const countryInput = optionalCountry(country);
  const orgInput = validateOrganizationInput(orgBody); // se valida todo antes de crear nada
  const storeInput = validateStoreInput(storeBody);
  const result = await callAuth(() => auth.api.signUpEmail({ body: { email, password, name } }));
  try {
    await saveCountry(result.user.id, countryInput);
    const created = await createSellerOrganization(result.user.id, orgInput, storeInput);
    return {
      token: result.token,
      user: publicUser({ ...result.user, role: 'seller', country: countryInput }),
      organization: presentOrganization(created.organization),
      store: presentStore(created.store),
    };
  } catch (err) {
    await db.delete(user).where(eq(user.id, result.user.id)); // compensación: sin organización no hay seller
    throw err;
  }
}

export async function signInWithPassword(role, { email, password }) {
  const result = await callAuth(() => auth.api.signInEmail({ body: { email, password } }));
  return enforceRole(result, role);
}

export async function signInWithCode(role, { email, otp }) {
  const result = await callAuth(() => auth.api.signInEmailOTP({ body: { email, otp } }));
  return enforceRole(result, role);
}
