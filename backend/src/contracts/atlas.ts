/** The 25 slots of a Spec ID, as the API names them (ADR 0025). */
export type SlotKey =
  | 'productType'
  | 'material'
  | 'coating'
  | 'colourClarity'
  | 'shape'
  | 'profile'
  | 'capacity'
  | 'topDiameter'
  | 'bottomDiameter'
  | 'height'
  | 'length'
  | 'width'
  | 'gusset'
  | 'unitWeight'
  | 'basisWeight'
  | 'thickness'
  | 'wall'
  | 'print'
  | 'compartments'
  | 'plies'
  | 'lidOpening'
  | 'handle'
  | 'wrap'
  | 'window'
  | 'variant';

export type SlotRule = 'applies' | 'never' | 'round_only' | 'non_round_only' | 'paper_only';

export interface DictionaryValue {
  /** The option's key, as a Spec ID's slot holds it: its number, as text (ADR 0033). */
  code: string;
  meaning: string;
  /** Its number in its list, written after the list's letter in a code: material 17 is `B17` (ADR 0032). */
  number: number;
  /** For a material, the key of the broader material it is a grade of: kraft for recycled kraft; else null (ADR 0033). */
  broader: string | null;
  /** Words an approved suggestion gave it, read in pasted text as it (ADR 0031); the word list in the code is not among them. */
  searchWords: string[];
}

export interface DictionarySlot {
  key: SlotKey;
  /** As people read it: "Colour / clarity". */
  name: string;
  values: DictionaryValue[];
}

export interface SlotRuleEntry {
  productType: string;
  slot: SlotKey;
  rule: SlotRule;
}

/** `GET /atlas/dictionary`. */
export interface AtlasDictionary {
  release: string;
  /** `YYYY-MM-DD`. */
  approvedOn: string;
  /** The thirteen slots whose values the dictionary holds, in code order. */
  slots: DictionarySlot[];
  rules: SlotRuleEntry[];
  /** The latest approved change, `at` ISO 8601; null before the first (ADR 0031). */
  change: { number: number; at: string } | null;
}

export interface DecodedSlot {
  /** 1–25. */
  number: number;
  key: SlotKey;
  name: string;
  /** The slot's value as it is stored: an option's number `17`, a capacity `10012`, a size `0090`, or `Y` (not known) or `X` (doesn't apply). */
  raw: string;
  /** How the code writes it: `B17`, `G112`, `H90`; empty when the code leaves it out (ADR 0032). */
  part: string;
  state: 'value' | 'not-known' | 'does-not-apply';
  /** "Bowl lid", "90 mm", "3.3 g", "Not known", "Doesn't apply". */
  meaning: string;
}

/** A Spec ID, read slot by slot. */
export interface DecodedSpecId {
  /** Each known fact as a letter and a number, sizes after one hyphen: `A5B17D3E1Q2R3-G112H90J110` (ADR 0032). */
  code: string;
  dictionaryRelease: string;
  /** Always 25, in code order. */
  slots: DecodedSlot[];
}

/**
 * `POST /atlas/spec-ids/decode`. A code written today, its letters in any
 * order and either case, or a dotted code given out before (ADR 0025).
 */
export interface DecodeSpecIdRequest {
  code: string;
}

/** A measured value as typed, never a JavaScript number: `{ value: "1.375", unit: "in" }`. */
export interface MeasurementFact {
  value: string;
  /** `mm`, `cm` or `in` for dimensions; `g` for unit weight; `gsm`; `um` for thickness. */
  unit: string;
}

export interface CapacityFact {
  /** A capacity unit letter from the dictionary: `Z`, `M`, `S`, `N` or `G`. */
  unit: string;
  /** More than 0, at most 9999, at most 6 decimal places: `12`, `3.25` (ADR 0032). */
  value: string;
}

/**
 * What is known about a product. A slot left out, or `null`, has no value:
 * the code leaves it out, and its slot holds `X` where it doesn't apply and
 * `Y` everywhere else.
 */
export interface SpecIdFacts {
  productType: string;
  material?: string | null;
  coating?: string | null;
  colourClarity?: string | null;
  shape?: string | null;
  profile?: string | null;
  capacity?: CapacityFact | null;
  topDiameter?: MeasurementFact | null;
  bottomDiameter?: MeasurementFact | null;
  height?: MeasurementFact | null;
  length?: MeasurementFact | null;
  width?: MeasurementFact | null;
  gusset?: MeasurementFact | null;
  unitWeight?: MeasurementFact | null;
  basisWeight?: MeasurementFact | null;
  thickness?: MeasurementFact | null;
  wall?: string | null;
  print?: string | null;
  /** A whole number, 1–12. */
  compartments?: string | null;
  /** A whole number, 1–4. */
  plies?: string | null;
  lidOpening?: string | null;
  handle?: string | null;
  wrap?: string | null;
  window?: string | null;
}

/** `POST /atlas/spec-ids/encode`. Answers with a `DecodedSpecId`; nothing is saved. */
export interface EncodeSpecIdRequest {
  facts: SpecIdFacts;
}

/** Who saved a Spec ID. */
export interface SavedBy {
  id: string;
  fullName: string;
}

/** A Spec ID someone saved, with its name and who saved it when. */
export interface SavedSpecId extends DecodedSpecId {
  /** Permanent: it never changes, though the code does. */
  id: string;
  /** 1–120 characters. */
  name: string;
  savedBy: SavedBy;
  /** ISO 8601. */
  savedAt: string;
  /** 1 when saved; raised by 1 on every saved change. Send it back with `PATCH`. */
  version: number;
  /** Null until the first change. */
  updatedBy: SavedBy | null;
  /** ISO 8601; null until the first change. */
  updatedAt: string | null;
  /** How many of its manufacturers have reached each stage, at it or later (#73). */
  manufacturerStages: ManufacturerStageCounts;
}

/** How many of a Spec ID's manufacturers have reached each stage, at it or later: one In production and one Quoted are 2, 2, 1, 1 (#73). */
export interface ManufacturerStageCounts {
  specificationsReceived: number;
  quoted: number;
  sampling: number;
  inProduction: number;
}

/** `POST /atlas/spec-ids`. */
export interface SaveSpecIdRequest {
  name: string;
  facts: SpecIdFacts;
}

/** `error.details` of a 409 `SPEC_ID_EXISTS`: the Spec ID already saved under this code. */
export interface SpecIdExistsDetails {
  existing: SavedSpecId;
}

/** `GET /atlas/spec-ids?<slot>=<value>…`. Each group is newest first. */
export interface SimilarSpecIds {
  fits: SavedSpecId[];
  mightFit: SavedSpecId[];
}

/** `GET /atlas/saved`: one page of the library, newest change first. */
export interface SpecIdLibraryPage {
  /** At most `pageSize`. */
  items: SavedSpecId[];
  /** The page this response is, starting at 1. A request past the end is the last page. */
  page: number;
  /** How many Spec IDs a page holds. 20. */
  pageSize: number;
  /** How many match `q` and `productType`. */
  total: number;
}

/** `PATCH /atlas/saved/:id`. */
export interface UpdateSpecIdRequest {
  name: string;
  facts: SpecIdFacts;
  /** The `version` the change was started from. */
  version: number;
}

/** One slot that a change altered, in plain words. */
export interface SlotChange {
  key: SlotKey;
  /** As people read it: "Top diameter". */
  name: string;
  /** "Not known", "Doesn't apply", "90 mm". */
  before: string;
  after: string;
  /** A known value was replaced. */
  corrected: boolean;
}

/** One entry of `GET /atlas/saved/:id/history`, newest first. */
export interface SpecIdChange {
  kind: 'created' | 'updated';
  changedBy: SavedBy;
  /** ISO 8601. */
  changedAt: string;
  /** Null for `created`. */
  codeBefore: string | null;
  codeAfter: string;
  /** Null for `created`. */
  nameBefore: string | null;
  nameAfter: string;
  /** Empty for `created`, and for a change of name only. */
  slots: SlotChange[];
  /** The approved dictionary change that made it, with who suggested and who approved it; null for anyone's own edit (ADR 0031). */
  dictionaryChange: { number: number; suggestedBy: SavedBy; approvedBy: SavedBy } | null;
}

/** A Spec ID that once had the code asked for. */
export interface FormerHolder {
  id: string;
  name: string;
  /** Its code now. */
  code: string;
  /** ISO 8601: when it stopped having the code asked for. */
  until: string;
}

/** `GET /atlas/spec-ids/:code`. */
export interface SpecIdLookup extends SavedSpecId {
  /**
   * The code asked for, when no Spec ID has it now and this one once did, or
   * this one has it in the letters an approved change renamed it to; otherwise null.
   */
  replacedCode: string | null;
  /** Every other Spec ID that once had the code asked for, newest first. */
  formerHolders: FormerHolder[];
}

/** `POST /atlas/spec-ids/read`: raw text, and a product type to read it as when the text names none. */
export interface ReadSpecIdTextRequest {
  text: string;
  productType?: string;
}

/** #28's rulings for a size that does not say what it measures. */
export type TextRuling = 'R1' | 'R1b' | 'R2' | 'R3' | 'R5' | 'R6';

/** One fact read from raw text. */
export interface TextReadFact {
  key: SlotKey;
  name: string;
  /** As the slot reads in a decoded code: "14 oz", "Molded fibre, bagasse". */
  meaning: string;
  /** As the text wrote them; empty for a fact a later pass read, such as a size written beside its name. */
  words: string;
  ruling: TextRuling | null;
}

/** A slot the text gives two values for: left out of the code. */
export interface TextConflict {
  key: SlotKey;
  name: string;
  /** Each value's words, as the text wrote them. */
  found: string[];
}

/** `POST /atlas/spec-ids/read`: what was read, what was not, and the code once there is a product type. Nothing is saved. */
export interface SpecIdTextReading {
  read: TextReadFact[];
  ignored: string[];
  conflicts: TextConflict[];
  /**
   * Sentences about what was read: a lid named by what it fits, two values
   * for one fact, a size converted, and what a word left over could mean
   * (plan 0011).
   */
  notes: string[];
  decoded: DecodedSpecId | null;
}

/** A manufacturer's stage on a Spec ID (#57): the quotes give the first two, an admin the last two. */
export type ManufacturerStage = 'specifications-received' | 'quoted' | 'sampling' | 'in-production';

/** One verified-list row's quote, each value as the workbook shows it; null when empty. */
export interface ManufacturerQuote {
  itemName: string | null;
  fobPerUnit: string | null;
  fobPerCase: string | null;
  fobTotal: string | null;
  moldCost: string | null;
  moldLeadTime: string | null;
  sampleLeadTime: string | null;
  productionLeadTime: string | null;
}

/** A manufacturer on one Spec ID, once, with its stage and every quote. */
export interface SpecIdManufacturer {
  id: string;
  name: string;
  country: string | null;
  stage: ManufacturerStage;
  /** The last change an admin made, if any; a cleared stage still shows who cleared it. ISO 8601 `at`. */
  stageSet: { by: SavedBy; at: string; stage: 'sampling' | 'in-production' | null } | null;
  quotes: ManufacturerQuote[];
}

/** `GET /atlas/saved/:id/manufacturers`. */
export interface SpecIdManufacturers {
  specId: { id: string; name: string; code: string };
  /** By name. */
  manufacturers: SpecIdManufacturer[];
}

/** `PUT /atlas/saved/:id/manufacturers/:manufacturerId/stage`, admins only. `null` clears the stage. */
export interface SetManufacturerStageRequest {
  stage: 'sampling' | 'in-production' | null;
}

/* Dictionary suggestions (#95, ADR 0031). */

/** The thirteen slots whose values the dictionary holds. */
export type DictionarySlotKey =
  | 'productType'
  | 'material'
  | 'coating'
  | 'colourClarity'
  | 'shape'
  | 'profile'
  | 'capacity'
  | 'wall'
  | 'print'
  | 'lidOpening'
  | 'handle'
  | 'wrap'
  | 'window';

export type DictionarySuggestionKind = 'add' | 'edit' | 'delete' | 'rules';

/** What a suggestion asks for, by kind. Field rules are keyed by the ruled slots, `coating` to `window`. */
export type DictionaryProposal =
  | {
      kind: 'add';
      meaning: string;
      searchWords: readonly string[];
      /** Every ruled field's rule, for a new product type; null for any other list. */
      rules: Readonly<Partial<Record<SlotKey, SlotRule>>> | null;
      /** For a new material, the key of the material it is a grade of; null or left out for none (ADR 0033). */
      broader?: string | null;
    }
  | {
      kind: 'edit';
      /** Null leaves each as it is; at least one is not null. `newCode` is always null: an option's number never changes (ADR 0033). */
      newCode: string | null;
      meaning: string | null;
      /** The whole new list, replacing today's. */
      searchWords: readonly string[] | null;
    }
  | {
      kind: 'delete';
      /** What saved Spec IDs holding the option become: another option's key, `Y`, or null when none holds it. */
      replacement: string | null;
    }
  | { kind: 'rules'; rules: Readonly<Partial<Record<SlotKey, SlotRule>>> };

/**
 * `POST /atlas/dictionary/suggestions`. `code` is the key of the option it is
 * about; empty for an add, which is numbered when it is approved (ADR 0033).
 */
export interface SuggestDictionaryChangeRequest {
  slot: DictionarySlotKey;
  code: string;
  proposal: DictionaryProposal;
}

/** `PUT /atlas/dictionary/suggestions/:id`: the suggester's edit, from the version they read. */
export interface EditDictionarySuggestionRequest extends SuggestDictionaryChangeRequest {
  version: number;
}

export type DictionarySuggestionState = 'waiting' | 'approved' | 'rejected' | 'withdrawn';

/** A suggestion, as the lists answer it. Dates are ISO 8601. */
export interface DictionarySuggestion {
  id: string;
  kind: DictionarySuggestionKind;
  slot: DictionarySlotKey;
  code: string;
  proposal: DictionaryProposal;
  state: DictionarySuggestionState;
  /** Raised on each edit. */
  version: number;
  suggestedBy: SavedBy;
  suggestedAt: string;
  /** Who approved or rejected it. */
  decidedBy: SavedBy | null;
  /** When it was approved, rejected or withdrawn. */
  decidedAt: string | null;
  /** Why it was rejected. */
  reason: string | null;
  /** The dictionary change it became, once approved. */
  changeNumber: number | null;
}

export interface DictionarySuggestionEvent {
  kind: 'suggested' | 'edited' | 'withdrawn' | 'approved' | 'rejected';
  by: SavedBy;
  at: string;
  /** An edit's proposal before it. */
  proposalBefore: DictionaryProposal | null;
  /** What a suggestion or an edit asks for. */
  proposalAfter: DictionaryProposal | null;
  /** A rejection's reason. */
  reason: string | null;
}

/**
 * `GET /atlas/dictionary/suggestions/:id`: one suggestion, its trail (first
 * step first), and its option's use today. While it waits, also what
 * approving it now would rewrite, or why approving it now would be refused;
 * both null once decided.
 */
export interface DictionarySuggestionDetail extends DictionarySuggestion {
  events: DictionarySuggestionEvent[];
  /** How many saved Spec IDs hold the option now. */
  usage: number;
  /** Each saved Spec ID whose code approving would change, with its code now and after. */
  rewrites: { id: string; name: string; codeBefore: string; codeAfter: string }[] | null;
  /** The message approving now would be refused with. */
  problem: string | null;
}

/** `POST /atlas/dictionary/suggestions/:id/approve`, admins only: the version the approver read. */
export interface ApproveDictionarySuggestionRequest {
  version: number;
}

/** `POST /atlas/dictionary/suggestions/:id/reject`, admins only. */
export interface RejectDictionarySuggestionRequest {
  /** 1–500 characters, shown to the suggester. */
  reason: string;
}

/** An approval's answer: the suggestion, the numbered change it became, and how many saved Spec IDs it rewrote. */
export interface DictionaryChangeApproved {
  suggestion: DictionarySuggestion;
  changeNumber: number;
  specIdsRewritten: number;
}

/** `GET /atlas/dictionary/usage/:slot/:code` and `GET /atlas/dictionary/suggestions/waiting-count`. */
export interface DictionaryCount {
  count: number;
}
