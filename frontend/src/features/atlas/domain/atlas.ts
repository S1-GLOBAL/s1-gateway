/** The 18 slots of an S1 Spec ID, as the API names them (ADR 0019). */
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

/** One release of the S1 dictionary. */
export interface AtlasDictionary {
  release: string;
  /** `YYYY-MM-DD`. */
  approvedOn: string;
  /** The seven slots whose values the dictionary holds, in code order. */
  slots: DictionarySlot[];
  /** By product type code, then slot order. */
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
}

/** A Spec ID someone named and saved. */
export interface SavedSpecId extends DecodedSpecId {
  /** 1–120 characters. */
  name: string;
  savedBy: { id: string; fullName: string };
  savedAt: Date;
}

/** The slots a lookup asks about, each with a raw slot value (`topDiameter: "0090"`). */
export type SimilarCriteria = Partial<Record<SlotKey, string>>;

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
  { key: 'variant', name: 'Variant number' },
];
