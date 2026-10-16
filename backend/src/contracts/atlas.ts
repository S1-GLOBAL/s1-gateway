/** The 18 slots of an S1 Spec ID, as the API names them. */
export type SlotKey =
  | 'formatVersion'
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
  | 'variant';

export type SlotRule = 'applies' | 'never' | 'round_only' | 'non_round_only' | 'paper_only';

export interface DictionaryValue {
  code: string;
  meaning: string;
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
  /** The seven slots whose values the dictionary holds, in code order. */
  slots: DictionarySlot[];
  rules: SlotRuleEntry[];
}

export interface DecodedSlot {
  /** 1–18. */
  number: number;
  key: SlotKey;
  name: string;
  /** The slot's characters, exactly as they appear in the code. */
  raw: string;
  state: 'value' | 'not-known' | 'does-not-apply';
  /** "Bowl lid", "90 mm", "3.3 g", "Not known", "Doesn't apply". */
  meaning: string;
}

/** A Spec ID, read slot by slot. */
export interface DecodedSpecId {
  code: string;
  dictionaryRelease: string;
  /** Always 18, in code order. */
  slots: DecodedSlot[];
}

/** `POST /atlas/spec-ids/decode`. */
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
  /** A whole number, 1–9999. */
  value: string;
}

/**
 * What is known about a product. A slot left out, or `null`, has no value:
 * the encoder writes `X` where the slot doesn't apply and `0` everywhere else.
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
  /** At most 20. */
  items: SavedSpecId[];
  /** Pass as `cursor` for the next page; null on the last page. */
  nextCursor: string | null;
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
  /** The code asked for, when no Spec ID has it now and this one once did; otherwise null. */
  replacedCode: string | null;
  /** Every other Spec ID that once had the code asked for, newest first. */
  formerHolders: FormerHolder[];
}
