/** The 25 slots of a Spec ID, as the API names them (ADR 0019, ADR 0024, ADR 0025). */
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

/** Whether a slot applies to a product type, or what it depends on. */
export type SlotRule = 'applies' | 'never' | 'round_only' | 'non_round_only' | 'paper_only';

/** The specification's own words for each rule. */
export const RULE_LABELS: Readonly<Record<SlotRule, string>> = {
  applies: 'Applies',
  never: 'X',
  round_only: 'Round only',
  non_round_only: 'Non-round only',
  paper_only: 'Paper family only',
};

export interface DictionaryValue {
  code: string;
  meaning: string;
  /** Words an approved suggestion gave it, read in pasted text as it (ADR 0031). */
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

/** An approved change to the dictionary, numbered from 1 in the order approved (ADR 0031). */
export interface DictionaryChange {
  number: number;
  at: Date;
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
  /** The latest approved change; null before the first. */
  change: DictionaryChange | null;
}

export interface DecodedSlot {
  /** 1–25. */
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
  /** Always 25, in code order. */
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
  /** How far its manufacturers have come (#73). Absent from an API older than #75. */
  manufacturerStages?: ManufacturerStageCounts;
}

/** How many of a Spec ID's manufacturers have reached each stage, at it or later (#73). */
export interface ManufacturerStageCounts {
  specificationsReceived: number;
  quoted: number;
  sampling: number;
  inProduction: number;
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
  /** The approved dictionary change that made it, with who suggested and who approved it; null for anyone's own edit. */
  dictionaryChange: { number: number; suggestedBy: Staff; approvedBy: Staff } | null;
}

/** The slots a lookup asks about, each with a raw slot value (`topDiameter: "0090"`). */
export type SimilarCriteria = Partial<Record<SlotKey, string>>;

/** What the library is asked for. Each is optional; an omitted `page` is the first. */
export interface LibraryQuery {
  /** Part of a name, ignoring case. */
  q?: string;
  /** A product type's code. */
  productType?: string;
  /** The page to load, starting at 1. */
  page?: number;
}

/** One page of the library, newest change first. */
export interface SpecIdLibraryPage {
  /** At most `pageSize`. */
  items: SavedSpecId[];
  /** The page this response is, starting at 1. */
  page: number;
  /** How many Spec IDs a page holds. */
  pageSize: number;
  /** How many match the search and product type. */
  total: number;
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

/** #28's rulings for a size that does not say what it measures. */
export type TextRuling = 'R1' | 'R1b' | 'R2' | 'R3' | 'R5' | 'R6';

/** One fact read from raw text. */
export interface TextReadFact {
  key: SlotKey;
  name: string;
  /** As the slot reads in a decoded code: "14 oz", "Molded fibre, bagasse". */
  meaning: string;
  /** As the text wrote them. */
  words: string;
  ruling: TextRuling | null;
}

/** A slot the text gives two or more values for: left out of the code. */
export interface TextConflict {
  key: SlotKey;
  name: string;
  /** Each value's words, as the text wrote them. */
  found: string[];
}

/** What raw text reads as, and the code once there is a product type. Nothing is saved. */
export interface SpecIdTextReading {
  /** In code order. */
  read: TextReadFact[];
  /** The words no rule used, as the text wrote them. */
  ignored: string[];
  conflicts: TextConflict[];
  /** Null when no product type was found or given. */
  decoded: DecodedSpecId | null;
}

/** A manufacturer's stage on a Spec ID (#57): the quotes give the first two, an admin the last two. */
export type ManufacturerStage = 'specifications-received' | 'quoted' | 'sampling' | 'in-production';

/** The stages only an admin sets. */
export type AdminStage = 'sampling' | 'in-production';

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
  /** The last change an admin made, if any; `stage` is null once it was cleared. */
  stageSet: { by: Staff; at: Date; stage: AdminStage | null } | null;
  quotes: ManufacturerQuote[];
}

/** A Spec ID's manufacturers, by name. */
export interface SpecIdManufacturers {
  specId: { id: string; name: string; code: string };
  manufacturers: SpecIdManufacturer[];
}
