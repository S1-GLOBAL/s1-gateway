import type { Clock } from '../../shared/application/ports/clock.js';
import type { IdGenerator } from '../../shared/application/ports/id-generator.js';
import type { Database } from '../../shared/infrastructure/database/connection.js';
import type { HttpModule } from '../../shared/presentation/http/http-module.js';
import { requireAuth } from '../accounts/index.js';
import { DecodeSpecId } from './application/decode-spec-id.js';
import { EncodeSpecId } from './application/encode-spec-id.js';
import { FindSimilarSpecIds } from './application/find-similar-spec-ids.js';
import { FindSpecIdByCode } from './application/find-spec-id-by-code.js';
import { GetDictionary } from './application/get-dictionary.js';
import { GetSavedSpecId } from './application/get-saved-spec-id.js';
import { GetSpecIdHistory } from './application/get-spec-id-history.js';
import { GetSpecIdManufacturers } from './application/get-spec-id-manufacturers.js';
import { ListSavedSpecIds } from './application/list-saved-spec-ids.js';
import { ReadSpecIdText } from './application/read-spec-id-text.js';
import { SaveSpecId } from './application/save-spec-id.js';
import { SetManufacturerStage } from './application/set-manufacturer-stage.js';
import { UpdateSpecId } from './application/update-spec-id.js';
import { DrizzleDictionaryRepository } from './infrastructure/drizzle-dictionary-repository.js';
import { DrizzleSourcingRepository } from './infrastructure/drizzle-sourcing-repository.js';
import { DrizzleSpecIdRepository } from './infrastructure/drizzle-spec-id-repository.js';
import { AtlasController } from './presentation/atlas.controller.js';
import { createAtlasAdminRouter, createAtlasRouter } from './presentation/atlas.routes.js';

export interface AtlasModuleDependencies {
  db: Database;
  clock: Clock;
  ids: IdGenerator;
}

/**
 * The module's composition root: the one place its adapters meet its use
 * cases. Two modules on `/atlas`: every signed-in staff member's routes, and
 * the admins' (#57).
 */
export function buildAtlasModule(deps: AtlasModuleDependencies): HttpModule[] {
  const dictionaries = new DrizzleDictionaryRepository(deps.db);
  const specIds = new DrizzleSpecIdRepository(deps.db);
  const sourcing = new DrizzleSourcingRepository(deps.db);
  const controller = new AtlasController(
    new GetDictionary(dictionaries),
    new DecodeSpecId(dictionaries),
    new EncodeSpecId(dictionaries),
    new SaveSpecId(dictionaries, specIds, deps.clock, deps.ids),
    new FindSpecIdByCode(dictionaries, specIds),
    new FindSimilarSpecIds(dictionaries, specIds),
    (req) => {
      const { account } = requireAuth(req);
      return { id: account.id, fullName: account.fullName };
    },
    {
      getSaved: new GetSavedSpecId(dictionaries, specIds),
      update: new UpdateSpecId(dictionaries, specIds, deps.clock, deps.ids),
      history: new GetSpecIdHistory(dictionaries, specIds),
      library: new ListSavedSpecIds(dictionaries, specIds),
    },
    new ReadSpecIdText(dictionaries),
    {
      list: new GetSpecIdManufacturers(specIds, sourcing),
      setStage: new SetManufacturerStage(specIds, sourcing, deps.clock, deps.ids),
    },
  );
  return [
    { path: '/atlas', router: createAtlasRouter(controller), access: 'session' },
    { path: '/atlas', router: createAtlasAdminRouter(controller), access: 'admin' },
  ];
}
