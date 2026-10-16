import type { Database } from '../../shared/infrastructure/database/connection.js';
import type { HttpModule } from '../../shared/presentation/http/http-module.js';
import { DecodeSpecId } from './application/decode-spec-id.js';
import { EncodeSpecId } from './application/encode-spec-id.js';
import { GetDictionary } from './application/get-dictionary.js';
import { DrizzleDictionaryRepository } from './infrastructure/drizzle-dictionary-repository.js';
import { AtlasController } from './presentation/atlas.controller.js';
import { createAtlasRouter } from './presentation/atlas.routes.js';

export interface AtlasModuleDependencies {
  db: Database;
}

/** The module's composition root: the one place its adapters meet its use cases. */
export function buildAtlasModule(deps: AtlasModuleDependencies): HttpModule {
  const dictionaries = new DrizzleDictionaryRepository(deps.db);
  const controller = new AtlasController(
    new GetDictionary(dictionaries),
    new DecodeSpecId(dictionaries),
    new EncodeSpecId(dictionaries),
  );
  return { path: '/atlas', router: createAtlasRouter(controller), access: 'session' };
}
