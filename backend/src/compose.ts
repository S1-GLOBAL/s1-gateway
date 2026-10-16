import type { Express, RequestHandler } from 'express';
import { buildAccountsModule } from './modules/accounts/index.js';
import { buildAtlasModule } from './modules/atlas/index.js';
import { buildHealthModule } from './modules/health/index.js';
import { buildToolsModule } from './modules/tools/index.js';
import type { Clock } from './shared/application/ports/clock.js';
import type { IdGenerator } from './shared/application/ports/id-generator.js';
import type { Logger } from './shared/application/ports/logger.js';
import type { Database } from './shared/infrastructure/database/connection.js';
import { createApp } from './shared/presentation/http/create-app.js';

export interface AppDependencies {
  db: Database;
  logger: Logger;
  clock: Clock;
  ids: IdGenerator;
  corsOrigin: string;
  accountAdminEmails: readonly string[];
  cookieSecure: boolean;
  requestLogger?: RequestHandler;
}

/** Every module, wired. `main.ts` and the end-to-end tests both build the app here. */
export function composeApp(deps: AppDependencies): Express {
  const accounts = buildAccountsModule({
    db: deps.db,
    clock: deps.clock,
    ids: deps.ids,
    accountAdminEmails: deps.accountAdminEmails,
    corsOrigin: deps.corsOrigin,
    cookieSecure: deps.cookieSecure,
  });

  return createApp({
    logger: deps.logger,
    corsOrigin: deps.corsOrigin,
    requestLogger: deps.requestLogger,
    sessionGate: accounts.sessionGate,
    adminGate: accounts.adminGate,
    modules: [
      buildHealthModule(),
      ...accounts.modules,
      buildToolsModule({ db: deps.db, clock: deps.clock, ids: deps.ids }),
      buildAtlasModule({ db: deps.db, clock: deps.clock, ids: deps.ids }),
    ],
  });
}
