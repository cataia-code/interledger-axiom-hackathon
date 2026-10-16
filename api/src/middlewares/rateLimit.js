import { createHash } from 'node:crypto';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { config } from '../config/index.js';
import { HttpError } from './errorHandler.js';

// Una sesión autenticada cuenta por su token (varios usuarios tras una misma IP móvil no se pisan);
// sin sesión, por IP. Los contadores están en memoria: con varias instancias hay que usar un almacén compartido.
const keyOf = (req) => {
  const auth = req.get('authorization');
  return auth ? `t:${createHash('sha1').update(auth).digest('hex')}` : `ip:${ipKeyGenerator(req.ip ?? '')}`;
};

// En test el límite se multiplica para no estorbar a las pruebas; los tests de límites usan `max` explícito.
export function limiter(max, { windowMs = 60_000, scale = config.env === 'test' ? 1000 : 1 } = {}) {
  return rateLimit({
    windowMs,
    limit: max * scale,
    keyGenerator: keyOf,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    validate: config.env !== 'test',
    handler: (req, res, next) => next(new HttpError(429, 'Too many requests. Please try again later.', 'RATE_LIMITED')),
  });
}

const reads = limiter(600);
const writes = limiter(120);

// Límite general por método: lecturas 600/min, escrituras 120/min.
export const generalLimit = (req, res, next) => (['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? reads : writes)(req, res, next);
