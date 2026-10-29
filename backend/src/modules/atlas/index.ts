import type { Clock } from '../../shared/application/ports/clock.js';
import type { IdGenerator } from '../../shared/application/ports/id-generator.js';
import type { Database } from '../../shared/infrastructure/database/connection.js';
import type { HttpModule } from '../../shared/presentation/http/http-module.js';
import { requireAuth } from '../accounts/index.js';
import { ApproveDictionarySuggestion } from './application/approve-dictionary-suggestion.js';
import { CountWaitingSuggestions } from './application/count-waiting-suggestions.js';
import { DecodeSpecId } from './application/decode-spec-id.js';
import { EditDictionarySuggestion } from './application/edit-dictionary-suggestion.js';
import { EncodeSpecId } from './application/encode-spec-id.js';
import { FindSimilarSpecIds } from './application/find-similar-spec-ids.js';
import { FindSpecIdByCode } from './application/find-spec-id-by-code.js';
import { GetDictionary } from './application/get-dictionary.js';
import { GetDictionarySuggestion } from './application/get-dictionary-suggestion.js';
import { GetDictionaryUsage } from './application/get-dictionary-usage.js';
import { GetSavedSpecId } from './application/get-saved-spec-id.js';
import { GetSpecIdHistory } from './application/get-spec-id-history.js';
import { GetSpecIdManufacturers } from './application/get-spec-id-manufacturers.js';
import { ListDictionarySuggestions } from './application/list-dictionary-suggestions.js';
import { ListSavedSpecIds } from './application/list-saved-spec-ids.js';
import { ReadSpecIdText } from './application/read-spec-id-text.js';
import { RejectDictionarySuggestion } from './application/reject-dictionary-suggestion.js';
import { SaveSpecId } from './application/save-spec-id.js';
import { SetManufacturerStage } from './application/set-manufacturer-stage.js';
import { SuggestDictionaryChange } from './application/suggest-dictionary-change.js';
import { UpdateSpecId } from './application/update-spec-id.js';
import { WithdrawDictionarySuggestion } from './application/withdraw-dictionary-suggestion.js';
import { DrizzleDictionaryChangeStore } from './infrastructure/drizzle-dictionary-change-store.js';
import { CachedDictionaryRepository } from './infrastructure/cached-dictionary-repository.js';
import { DrizzleDictionaryRepository } from './infrastructure/drizzle-dictionary-repository.js';
import { DrizzleSourcingRepository } from './infrastructure/drizzle-sourcing-repository.js';
import { DrizzleSpecIdRepository } from './infrastructure/drizzle-spec-id-repository.js';
import { DrizzleSuggestionRepository } from './infrastructure/drizzle-suggestion-repository.js';
import { AtlasController } from './presentation/atlas.controller.js';
import { createAtlasAdminRouter, createAtlasRouter } from './presentation/atlas.routes.js';
import { DictionarySuggestionsController } from './presentation/dictionary-suggestions.controller.js';
import {
  createDictionarySuggestionsAdminRouter,
  createDictionarySuggestionsRouter,
} from './presentation/dictionary-suggestions.routes.js';

export interface AtlasModuleDependencies {
  db: Database;
  clock: Clock;
  ids: IdGenerator;
}

/**
 * The module's composition root: the one place its adapters meet its use
 * cases. Two modules on `/atlas`: every signed-in staff member's routes, and
 * the admins' (#57); and the dictionary's suggestions on `/atlas/dictionary`,
 * with deciding them behind the admin gate (#95).
 */
export function buildAtlasModule(deps: AtlasModuleDependencies): HttpModule[] {
  const dictionaries = new CachedDictionaryRepository(new DrizzleDictionaryRepository(deps.db));
  const specIds = new DrizzleSpecIdRepository(deps.db);
  const sourcing = new DrizzleSourcingRepository(deps.db);
  const suggestions = new DrizzleSuggestionRepository(deps.db);
  const controller = new AtlasController(
    new GetDictionary(dictionaries),
    new DecodeSpecId(dictionaries),
    new EncodeSpecId(dictionaries),
    new SaveSpecId(dictionaries, specIds, sourcing, deps.clock, deps.ids),
    new FindSpecIdByCode(dictionaries, specIds, sourcing),
    new FindSimilarSpecIds(dictionaries, specIds, sourcing),
    (req) => {
      const { account } = requireAuth(req);
      return { id: account.id, fullName: account.fullName };
    },
    {
      getSaved: new GetSavedSpecId(dictionaries, specIds, sourcing),
      update: new UpdateSpecId(dictionaries, specIds, sourcing, deps.clock, deps.ids),
      history: new GetSpecIdHistory(dictionaries, specIds),
      library: new ListSavedSpecIds(dictionaries, specIds, sourcing),
    },
    new ReadSpecIdText(dictionaries),
    {
      list: new GetSpecIdManufacturers(specIds, sourcing),
      setStage: new SetManufacturerStage(specIds, sourcing, deps.clock, deps.ids),
    },
  );
  const suggestionsController = new DictionarySuggestionsController(
    {
      suggest: new SuggestDictionaryChange(dictionaries, specIds, suggestions, deps.clock, deps.ids),
      edit: new EditDictionarySuggestion(dictionaries, specIds, suggestions, deps.clock, deps.ids),
      withdraw: new WithdrawDictionarySuggestion(suggestions, deps.clock, deps.ids),
      list: new ListDictionarySuggestions(suggestions),
      get: new GetDictionarySuggestion(dictionaries, suggestions, specIds),
      countWaiting: new CountWaitingSuggestions(suggestions),
      usage: new GetDictionaryUsage(specIds),
      approve: new ApproveDictionarySuggestion(
        dictionaries,
        specIds,
        suggestions,
        new DrizzleDictionaryChangeStore(deps.db),
        deps.clock,
        deps.ids,
      ),
      reject: new RejectDictionarySuggestion(suggestions, deps.clock, deps.ids),
    },
    (req) => {
      const { account } = requireAuth(req);
      return { id: account.id, isAdmin: account.isAdmin };
    },
  );
  return [
    { path: '/atlas', router: createAtlasRouter(controller), access: 'session' },
    { path: '/atlas/dictionary', router: createDictionarySuggestionsRouter(suggestionsController), access: 'session' },
    { path: '/atlas/dictionary', router: createDictionarySuggestionsAdminRouter(suggestionsController), access: 'admin' },
    { path: '/atlas', router: createAtlasAdminRouter(controller), access: 'admin' },
  ];
}
