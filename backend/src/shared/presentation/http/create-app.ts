import compression from 'compression';
import cors from 'cors';
import express, { type Express, type RequestHandler } from 'express';
import helmet from 'helmet';
import type { Logger } from '../../application/ports/logger.js';
import { createErrorHandler } from './error-handler.js';
import type { HttpAccess, HttpModule } from './http-module.js';
import { notFoundHandler } from './not-found-handler.js';

export interface AppOptions {
  modules: HttpModule[];
  logger: Logger;
  corsOrigin: string;
  /** Per-request logging. Left out in tests. */
  requestLogger?: RequestHandler;
  /**
   * Loads the session cookie and attaches the account. Required when any
   * module uses `session` or `admin` access (the default is `session`).
   */
  sessionGate?: RequestHandler;
  /** Ensures the signed-in account is an admin. Required when any module uses `admin`. */
  adminGate?: RequestHandler;
}

function accessOf(module: HttpModule): HttpAccess {
  return module.access ?? 'session';
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
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: options.corsOrigin, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '100kb' }));
  if (options.requestLogger) app.use(options.requestLogger);

  const publicModules = options.modules.filter((module) => accessOf(module) === 'public');
  const sessionModules = options.modules.filter((module) => accessOf(module) === 'session');
  const adminModules = options.modules.filter((module) => accessOf(module) === 'admin');

  if ((sessionModules.length > 0 || adminModules.length > 0) && !options.sessionGate) {
    throw new Error('createApp: sessionGate is required when any module uses session or admin access');
  }
  if (adminModules.length > 0 && !options.adminGate) {
    throw new Error('createApp: adminGate is required when any module uses admin access');
  }

  const api = express.Router();
  for (const module of publicModules) api.use(module.path, module.router);
  if (options.sessionGate && (sessionModules.length > 0 || adminModules.length > 0)) {
    api.use(options.sessionGate);
  }
  for (const module of sessionModules) api.use(module.path, module.router);
  if (options.adminGate && adminModules.length > 0) {
    api.use(options.adminGate);
  }
  for (const module of adminModules) api.use(module.path, module.router);
  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(createErrorHandler(options.logger));

  return app;
}
