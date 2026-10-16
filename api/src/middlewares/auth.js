import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth/index.js';
import { HttpError } from './errorHandler.js';

// Exige una sesión válida (Authorization: Bearer <token>) y la deja en req.auth.
export async function requireAuth(req, res, next) {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) throw new HttpError(401, 'Authentication required', 'UNAUTHORIZED');
    req.auth = session;
    next();
  } catch (err) {
    next(err);
  }
}

// Debe ir después de requireAuth.
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.auth?.user?.role)) {
      return next(new HttpError(403, 'Insufficient role', 'FORBIDDEN'));
    }
    next();
  };
}
