import type { Result } from '../../../../shared/domain/result.js';
import type { Dictionary } from '../dictionary.js';
import type { SavedSpecId } from '../saved-spec-id.js';
import type { DictionarySlotKey } from '../slots.js';
import type { SpecIdChange } from '../spec-id-change.js';
import type {
  DictionaryMovedOnError,
  SpecIdMovedOnError,
  SpecIdsWouldClashError,
  SuggestionChangedError,
} from './suggestion.errors.js';
import type { SuggestionStep } from './suggestion.js';

/** One saved Spec ID an approval rewrites: its next state, its history entry, and the version it was read at. */
export interface SpecIdRewrite {
  readonly saved: SavedSpecId;
  readonly change: SpecIdChange;
  readonly expectedVersion: number;
}

/** A saved Spec ID whose code an approval leaves, but whose slots it reletters (ADR 0032), and the version it was read at. */
export interface SpecIdRelettering {
  readonly saved: SavedSpecId;
  readonly expectedVersion: number;
}

/** The option an approval rewrites the holders of, and every saved Spec ID holding it when planned, at the version read. */
export interface OptionHolders {
  readonly slot: DictionarySlotKey;
  readonly code: string;
  readonly specIds: readonly { readonly id: string; readonly version: number }[];
}

/** Everything one approval writes (ADR 0031): all of it, or none of it. */
export interface DictionaryChangePlan {
  /** The latest change number the plan was made from; null before the first change. */
  readonly basedOn: number | null;
  /** The dictionary as the approval leaves it. */
  readonly dictionary: Dictionary;
  readonly change: {
    readonly number: number;
    readonly suggestionId: string;
    readonly approvedBy: string;
    readonly approvedAt: Date;
  };
  /** The approved suggestion and its `approved` event. */
  readonly suggestion: SuggestionStep;
  /** The version the approver saw. */
  readonly suggestionVersion: number;
  /** Null when the approval rewrites no Spec ID: a new option, or a new wording. */
  readonly holders: OptionHolders | null;
  readonly rewrites: readonly SpecIdRewrite[];
  readonly relettered: readonly SpecIdRelettering[];
}

export type DictionaryChangeError =
  | DictionaryMovedOnError
  | SuggestionChangedError
  | SpecIdMovedOnError
  | SpecIdsWouldClashError;

/**
 * The one writer of the dictionary (ADR 0031). `apply` writes a whole plan in
 * one transaction, one approval at a time, or nothing: when another approval
 * landed since `basedOn`, the suggestion moved on since it was read, a
 * saved Spec ID holding the option was saved, changed or moved away since
 * `holders` was read, or two Spec IDs would end with one code.
 */
export interface DictionaryChangeStore {
  apply(plan: DictionaryChangePlan): Promise<Result<void, DictionaryChangeError>>;
}
