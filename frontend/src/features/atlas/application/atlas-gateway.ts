import type {
  AtlasDictionary,
  DecodedSpecId,
  SavedSpecId,
  SimilarCriteria,
  SimilarSpecIds,
  SpecIdFacts,
} from '../domain/atlas';

/**
 * Where the Atlas feature reads the dictionary, decodes, builds, saves and
 * looks up Spec IDs. The application owns this port; infrastructure
 * implements it over HTTP. Every method rejects with an AppError; `save`
 * rejects with a SpecIdExistsError when the code is already saved.
 */
export interface AtlasGateway {
  dictionary(): Promise<AtlasDictionary>;
  decode(code: string): Promise<DecodedSpecId>;
  /** Builds the code for the facts. Nothing is saved. */
  encode(facts: SpecIdFacts): Promise<DecodedSpecId>;
  save(input: { name: string; facts: SpecIdFacts }): Promise<SavedSpecId>;
  findByCode(code: string): Promise<SavedSpecId>;
  findSimilar(criteria: SimilarCriteria): Promise<SimilarSpecIds>;
}
