/** The 26 slots of an S2 Spec ID, as the API names them (ADR 0019, ADR 0024). */
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
  | 'wall'
  | 'print'
  | 'compartments'
  | 'plies'
  | 'lidOpening'
  | 'handle'
  | 'wrap'
  | 'window'
  | 'variant';

/** Whether a slot applies to a product type, or what it depends on. */
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

/** One release of the Atlas dictionary. */
export interface AtlasDictionary {
  release: string;
  /** `YYYY-MM-DD`. */
  approvedOn: string;
  /** The thirteen slots whose values the dictionary holds, in code order. */
  slots: DictionarySlot[];
  /** By product type code, then slot order. */
  rules: SlotRuleEntry[];
}

export interface DecodedSlot {
  /** 1–26. */
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
  /** Always 26, in code order. */
  slots: DecodedSlot[];
}

/** A measured value as typed, never a number: `{ value: "1.375", unit: "in" }`. */
export interface MeasurementFact {
  value: string;
  /** `mm`, `cm` or `in` for dimensions; `g` for unit weight; `gsm`; `um` for thickness. */
  unit: string;
}

export interface CapacityFact {
  /** A capacity unit letter from the dictionary. */
  unit: string;
  /** A whole number, 1–9999. */
  value: string;
}

/** What is known about a product. A slot left out has no value: the server writes `X` or `0` for it. */
export interface SpecIdFacts {
  productType: string;
  material?: string;
  coating?: string;
  colourClarity?: string;
  shape?: string;
  profile?: string;
  capacity?: CapacityFact;
  topDiameter?: MeasurementFact;
  bottomDiameter?: MeasurementFact;
  height?: MeasurementFact;
  length?: MeasurementFact;
  width?: MeasurementFact;
  gusset?: MeasurementFact;
  unitWeight?: MeasurementFact;
  basisWeight?: MeasurementFact;
  thickness?: MeasurementFact;
  wall?: string;
  print?: string;
  /** A whole number, 1–12. */
  compartments?: string;
  /** A whole number, 1–4. */
  plies?: string;
  lidOpening?: string;
  handle?: string;
  wrap?: string;
  window?: string;
}

/** Who saved or changed a Spec ID. */
export interface Staff {
  id: string;
  fullName: string;
}

/** A Spec ID someone named and saved. */
export interface SavedSpecId extends DecodedSpecId {
  /** Permanent: it never changes, though the code does. */
  id: string;
  /** 1–120 characters. */
  name: string;
  savedBy: Staff;
  savedAt: Date;
  /** 1 when saved; raised by 1 on every change. A change sends back the one it started from. */
  version: number;
  /** Null until the first change. */
  updatedBy: Staff | null;
  updatedAt: Date | null;
}

/** A Spec ID that once had a code. */
export interface FormerHolder {
  id: string;
  name: string;
  /** Its code now. */
  code: string;
  /** When it stopped having the code. */
  until: Date;
}

/** A saved Spec ID found by a code: the one that has it now, or the last one that did. */
export interface SpecIdLookup extends SavedSpecId {
  /** The code asked for, when no Spec ID has it now and this one once did; otherwise null. */
  replacedCode: string | null;
  /** Every other Spec ID that once had the code, newest first. */
  formerHolders: FormerHolder[];
}

/** One slot a change altered, in plain words. */
export interface SlotChange {
  key: SlotKey;
  name: string;
  /** "Not known", "Doesn't apply", "62 mm". */
  before: string;
  after: string;
  /** A known value was replaced. */
  corrected: boolean;
}

/** One entry in a saved Spec ID's history. */
export interface SpecIdChange {
  kind: 'created' | 'updated';
  changedBy: Staff;
  changedAt: Date;
  /** Null for `created`. */
  codeBefore: string | null;
  codeAfter: string;
  /** Null for `created`. */
  nameBefore: string | null;
  nameAfter: string;
  /** Empty for `created`, and for a change of name only. */
  slots: SlotChange[];
}

/** The slots a lookup asks about, each with a raw slot value (`topDiameter: "0090"`). */
export type SimilarCriteria = Partial<Record<SlotKey, string>>;

/** What the library is asked for. Each is optional; `cursor` is the last page's `nextCursor`. */
export interface LibraryQuery {
  /** Part of a name, ignoring case. */
  q?: string;
  /** A product type's code. */
  productType?: string;
  cursor?: string;
}

/** One page of the library, newest change first. */
export interface SpecIdLibraryPage {
  /** At most 20. */
  items: SavedSpecId[];
  /** The next page's cursor; null on the last page. */
  nextCursor: string | null;
}

/** Saved Spec IDs, each group newest first. */
export interface SimilarSpecIds {
  /** Every chosen slot is equal. */
  fits: SavedSpecId[];
  /** The chosen slots are equal, or not known yet. */
  mightFit: SavedSpecId[];
}

/**
 * Every slot's name, in code order, exactly as the server names them. The page
 * needs them to show a code the server refused, part by part.
 */
export const SLOT_NAMES: readonly { readonly key: SlotKey; readonly name: string }[] = [
  { key: 'formatVersion', name: 'Format version' },
  { key: 'productType', name: 'Product type' },
  { key: 'material', name: 'Material' },
  { key: 'coating', name: 'Coating' },
  { key: 'colourClarity', name: 'Colour / clarity' },
  { key: 'shape', name: 'Shape' },
  { key: 'profile', name: 'Profile' },
  { key: 'capacity', name: 'Nominal capacity' },
  { key: 'topDiameter', name: 'Top diameter' },
  { key: 'bottomDiameter', name: 'Bottom diameter' },
  { key: 'height', name: 'Height' },
  { key: 'length', name: 'Length' },
  { key: 'width', name: 'Width' },
  { key: 'gusset', name: 'Gusset' },
  { key: 'unitWeight', name: 'Unit weight' },
  { key: 'basisWeight', name: 'Basis weight' },
  { key: 'thickness', name: 'Thickness' },
  { key: 'wall', name: 'Wall' },
  { key: 'print', name: 'Print' },
  { key: 'compartments', name: 'Compartments' },
  { key: 'plies', name: 'Plies' },
  { key: 'lidOpening', name: 'Lid opening' },
  { key: 'handle', name: 'Handle' },
  { key: 'wrap', name: 'Individual wrap' },
  { key: 'window', name: 'Window' },
  { key: 'variant', name: 'Variant number' },
];
