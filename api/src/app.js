import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth/index.js';
import { config } from './config/index.js';
import routes from './routes/index.js';
import { HttpError, notFound, errorHandler } from './middlewares/errorHandler.js';
import { createRoleAuthRouter } from './routes/roleAuth.js';

// Registro e inicio de sesión pasan por las rutas por rol (/auth/buyer/*, /auth/seller/*).
const closedAuthPaths = new Set(['/api/v1/auth/sign-up/email', '/api/v1/auth/sign-in/email', '/api/v1/auth/sign-in/email-otp']);

export function createApp() {
  const app = express();
  app.set('trust proxy', config.trustProxy);

  app.use(pinoHttp({ enabled: config.env !== 'test' }));
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin }));
  app.use((req, res, next) =>
    req.method === 'POST' && closedAuthPaths.has(req.path)
      ? next(new HttpError(404, 'Use /api/v1/auth/buyer/* or /api/v1/auth/seller/*', 'ENDPOINT_MOVED'))
      : next(),
  );
  app.use('/api/v1/auth', createRoleAuthRouter());

  // Better Auth debe ir antes de express.json(): lee el cuerpo por su cuenta.
  app.all('/api/v1/auth/*splat', toNodeHandler(auth));

  app.use(express.json());

  // Imágenes subidas (disco local del servidor).
  app.use('/uploads', (req, res, next) => {
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  }, express.static(config.uploadDir, { fallthrough: false, maxAge: '7d', immutable: true }));

  app.use('/api/v1', routes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

export default createApp();
