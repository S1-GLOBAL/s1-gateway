import type {
  AdminStage,
  AtlasDictionary,
  DecodedSpecId,
  LibraryQuery,
  SavedSpecId,
  SimilarCriteria,
  SimilarSpecIds,
  SpecIdChange,
  SpecIdFacts,
  SpecIdLibraryPage,
  SpecIdLookup,
  SpecIdManufacturer,
  SpecIdManufacturers,
  SpecIdTextReading,
} from '../domain/atlas';

/**
 * Where the Atlas feature reads the dictionary, decodes, builds, saves, changes
 * and looks up Spec IDs. The application owns this port; infrastructure
 * implements it over HTTP. Every method rejects with an AppError; `save` and
 * `update` reject with a SpecIdExistsError when the code is another saved Spec
 * ID's, and `update` with a SpecIdChangedError when someone saved first.
 */
export interface AtlasGateway {
  dictionary(): Promise<AtlasDictionary>;
  decode(code: string): Promise<DecodedSpecId>;
  /** Builds the code for the facts. Nothing is saved. */
  encode(facts: SpecIdFacts): Promise<DecodedSpecId>;
  save(input: { name: string; facts: SpecIdFacts }): Promise<SavedSpecId>;
  /** The Spec ID that has a code now, or the last one that did. */
  findByCode(code: string): Promise<SpecIdLookup>;
  findSimilar(criteria: SimilarCriteria): Promise<SimilarSpecIds>;
  /** Reads the facts in raw text, as `productType` when one is given. Nothing is saved. */
  /** `signal` stops the request once its answer is no longer wanted. */
  readText(input: { text: string; productType?: string }, signal?: AbortSignal): Promise<SpecIdTextReading>;
  /** One saved Spec ID by its permanent id. */
  getSaved(id: string): Promise<SavedSpecId>;
  /** Changes a saved Spec ID, from the `version` the change was started from. */
  update(id: string, input: { name: string; facts: SpecIdFacts; version: number }): Promise<SavedSpecId>;
  /** Every change to a saved Spec ID, newest first. */
  history(id: string): Promise<SpecIdChange[]>;
  /** One page of saved Spec IDs, newest change first. */
  library(query: LibraryQuery): Promise<SpecIdLibraryPage>;
  /** A saved Spec ID's manufacturers, each with its stage and quotes (#57). */
  manufacturers(id: string): Promise<SpecIdManufacturers>;
  /** Admins only: sets a manufacturer's stage on a Spec ID, or clears it with `null`. */
  setManufacturerStage(id: string, manufacturerId: string, stage: AdminStage | null): Promise<SpecIdManufacturer>;
}
