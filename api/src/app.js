import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { config } from './config/index.js';
import routes from './routes/index.js';
import { notFound, errorHandler } from './middlewares/errorHandler.js';

export function createApp() {
  const app = express();

  app.use(pinoHttp({ enabled: config.env !== 'test' }));
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  app.use('/api/v1', routes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

export default createApp();
