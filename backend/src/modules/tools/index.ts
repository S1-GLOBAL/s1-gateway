import type { Clock } from '../../shared/application/ports/clock.js';
import type { IdGenerator } from '../../shared/application/ports/id-generator.js';
import type { Database } from '../../shared/infrastructure/database/connection.js';
import type { HttpModule } from '../../shared/presentation/http/http-module.js';
import { CreateTool } from './application/create-tool.js';
import { ListTools } from './application/list-tools.js';
import { DrizzleToolRepository } from './infrastructure/drizzle-tool-repository.js';
import { ToolsController } from './presentation/tools.controller.js';
import { createToolsRouter } from './presentation/tools.routes.js';

export interface ToolsModuleDependencies {
  db: Database;
  clock: Clock;
  ids: IdGenerator;
}

/** The module's composition root: the one place its adapters meet its use cases. */
export function buildToolsModule(deps: ToolsModuleDependencies): HttpModule {
  const repository = new DrizzleToolRepository(deps.db);
  const controller = new ToolsController(
    new ListTools(repository),
    new CreateTool(repository, deps.clock, deps.ids),
  );
  return { path: '/tools', router: createToolsRouter(controller), access: 'session' };
}
