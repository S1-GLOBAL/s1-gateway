export type {
  AtlasDictionary,
  DecodedSpecId,
  SavedSpecId,
  SimilarCriteria,
  SimilarSpecIds,
  SlotKey,
  SlotRule,
  SpecIdFacts,
  SpecIdManufacturer,
  SpecIdManufacturers,
} from './domain/atlas';
export type { AtlasGateway } from './application/atlas-gateway';
export { AtlasGatewayProvider } from './application/atlas-gateway-context';
export type { SuggestionsGateway } from './application/suggestions-gateway';
export { SuggestionsGatewayProvider } from './application/suggestions-gateway-context';
export { useWaitingCount } from './application/use-suggestions';
export { SpecIdExistsError } from './application/spec-id-exists-error';
export { useDecodedCode } from './application/use-decoded-code';
export { useDictionary } from './application/use-dictionary';
export { useSavedSpecId } from './application/use-saved-spec-id';
export { useSpecIdManufacturers } from './application/use-spec-id-manufacturers';
export { HttpAtlasGateway } from './infrastructure/http-atlas-gateway';
export { HttpSuggestionsGateway } from './infrastructure/http-suggestions-gateway';
export { BackToAtlas } from './presentation/BackToAtlas';
export { AtlasLibrary } from './presentation/library/AtlasLibrary';
export { DictionarySheet } from './presentation/library/DictionarySheet';
export { DictionaryChanges } from './presentation/dictionary/DictionaryChanges';
export { SuggestionListSkeleton } from './presentation/dictionary/SuggestionListSkeleton';
export { NewSpecIdLink } from './presentation/library/NewSpecIdLink';
export { ManufacturerGroups } from './presentation/manufacturers/ManufacturerGroups';
export { NewSpecIdForm, type SavedNotice } from './presentation/NewSpecIdForm';
export { SpecIdEditor } from './presentation/SpecIdEditor';
