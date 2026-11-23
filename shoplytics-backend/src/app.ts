import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler, notFound } from './middleware/errorHandler';
import { limiters } from './middleware/rateLimit';
import routes from './routes';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  if (env.TRUST_PROXY > 0) app.set('trust proxy', env.TRUST_PROXY); // so req.ip (rate limiting) is the real client IP
  app.use(helmet());
  app.use(cors({ origin: env.clientOrigins, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  if (env.NODE_ENV !== 'test') app.use(morgan(env.isProduction ? 'combined' : 'dev'));

  app.use('/api/v1', limiters.global, routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
