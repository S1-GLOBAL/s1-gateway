import compression from 'compression';
import cors from 'cors';
import express, { type Express, type RequestHandler } from 'express';
import helmet from 'helmet';
import type { Logger } from '../../application/ports/logger.js';
import { createErrorHandler } from './error-handler.js';
import type { HttpModule } from './http-module.js';
import { notFoundHandler } from './not-found-handler.js';

export interface AppOptions {
  modules: HttpModule[];
  logger: Logger;
  corsOrigin: string;
  /** Per-request logging. Left out in tests. */
  requestLogger?: RequestHandler;
}

/**
 * Builds the Express app from modules it is given. It knows nothing about any
 * module — the composition root decides what is mounted.
 *
 * Express 5 forwards a rejected promise from an async handler to the error
 * handler by itself, so there is no asyncHandler wrapper.
 */
export function createApp(options: AppOptions): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(cors({ origin: options.corsOrigin }));
  app.use(compression());
  app.use(express.json({ limit: '100kb' }));
  if (options.requestLogger) app.use(options.requestLogger);

  const api = express.Router();
  for (const module of options.modules) api.use(module.path, module.router);
  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(createErrorHandler(options.logger));

  return app;
}
