import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth/index.js';
import { config } from './config/index.js';
import routes from './routes/index.js';
import { notFound, errorHandler } from './middlewares/errorHandler.js';

export function createApp() {
  const app = express();

  app.use(pinoHttp({ enabled: config.env !== 'test' }));
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin }));
  // Better Auth debe ir antes de express.json(): lee el cuerpo por su cuenta.
  app.all('/api/v1/auth/*splat', toNodeHandler(auth));

  app.use(express.json());

  app.use('/api/v1', routes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

export default createApp();
