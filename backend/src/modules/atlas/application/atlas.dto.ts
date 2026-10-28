import { writeCode } from '../domain/code.js';
import type { Dictionary } from '../domain/dictionary.js';
import type { SlotState, SpecId, SpecIdFactsInput } from '../domain/spec-id.js';
import type { FormerHolderRecord, SavedSpecIdRecord } from '../domain/spec-id-repository.js';
import type { Ruling } from '../domain/reading/size-rulings.js';
import { DICTIONARY_SLOTS, slotDefinition, type SlotKey, type SlotRule } from '../domain/slots.js';
import type { AdminStage, ManufacturerStageCounts, Stage } from '../domain/sourcing/stage.js';

/** The dictionary as the application hands it outward. */
export interface DictionaryDto {
  release: string;
  /** `YYYY-MM-DD`. */
  approvedOn: string;
  /** The thirteen slots whose values the dictionary holds, in code order. */
  slots: DictionarySlotDto[];
  /** By product type code, then slot order. */
  rules: SlotRuleEntryDto[];
  /** The latest approved change, `at` ISO 8601; null before the first (ADR 0031). */
  change: { number: number; at: string } | null;
}

export interface DictionarySlotDto {
  key: SlotKey;
  name: string;
  values: DictionaryValueDto[];
}

export interface DictionaryValueDto {
  code: string;
  meaning: string;
  /** Its number in its list, written after the list's letter in a code (ADR 0032). */
  number: number;
}

export interface SlotRuleEntryDto {
  productType: string;
  slot: SlotKey;
  rule: SlotRule;
}

/** A Spec ID read slot by slot. */
export interface DecodedSpecIdDto {
  code: string;
  dictionaryRelease: string;
  /** Always 25, in code order. */
  slots: DecodedSlotDto[];
}

export interface DecodedSlotDto {
  number: number;
  key: SlotKey;
  name: string;
  /** The value as it is stored: `BCS`, `Z0012`, `Y`, `X`. */
  raw: string;
  /** How the code writes it: `B17`; empty when it is left out (ADR 0032). */
  part: string;
  state: SlotState;
  meaning: string;
}

export interface DecodeSpecIdInput {
  code: string;
}

export interface EncodeSpecIdInput {
  facts: SpecIdFactsInput;
}

export function toDictionaryDto(dictionary: Dictionary): DictionaryDto {
  return {
    release: dictionary.release,
    approvedOn: dictionary.approvedOn,
    slots: DICTIONARY_SLOTS.map((key) => ({
      key,
      name: slotDefinition(key).name,
      values: dictionary.valuesOf(key).map(({ code, meaning, number }) => ({ code, meaning, number })),
    })),
    rules: dictionary.slotRules().map(({ productType, slot, rule }) => ({ productType, slot, rule })),
    change: dictionary.change === null ? null : { number: dictionary.change.number, at: dictionary.change.at.toISOString() },
  };
}

/**
 * A Spec ID read slot by slot. Its code is written from its slots, so a row an
 * older API saved with a dotted code during a deploy still shows today's (ADR 0032).
 */
export function toDecodedSpecIdDto(specId: SpecId, dictionary: Dictionary): DecodedSpecIdDto {
  return {
    code: writeCode((key) => specId.slot(key), dictionary) ?? specId.code,
    dictionaryRelease: dictionary.release,
    slots: specId.describe(dictionary).map((slot) => ({
      number: slot.number,
      key: slot.key,
      name: slot.name,
      raw: slot.raw,
      part: slot.part,
      state: slot.state,
      meaning: slot.meaning,
    })),
  };
}

/** Who saved or changed a Spec ID. */
export interface StaffDto {
  id: string;
  fullName: string;
}

/** A Spec ID someone saved, with its name and who saved it when. */
export interface SavedSpecIdDto extends DecodedSpecIdDto {
  id: string;
  name: string;
  savedBy: StaffDto;
  /** ISO 8601. */
  savedAt: string;
  version: number;
  updatedBy: StaffDto | null;
  /** ISO 8601. */
  updatedAt: string | null;
  /** How many of its manufacturers have reached each stage, at it or later (#73). */
  manufacturerStages: ManufacturerStageCounts;
}

export interface SpecIdLibraryPageDto {
  items: SavedSpecIdDto[];
  /** The page this response is, starting at 1. A request past the end is the last page. */
  page: number;
  /** How many Spec IDs a page holds. */
  pageSize: number;
  /** How many match the search and product type. */
  total: number;
}

export interface SlotChangeDto {
  key: SlotKey;
  name: string;
  before: string;
  after: string;
  corrected: boolean;
}

export interface SpecIdChangeDto {
  kind: 'created' | 'updated';
  changedBy: StaffDto;
  /** ISO 8601. */
  changedAt: string;
  codeBefore: string | null;
  codeAfter: string;
  nameBefore: string | null;
  nameAfter: string;
  slots: SlotChangeDto[];
  /** The approved dictionary change that made it, with who suggested and approved it; null for anyone's own edit. */
  dictionaryChange: { number: number; suggestedBy: StaffDto; approvedBy: StaffDto } | null;
}

export interface FormerHolderDto {
  id: string;
  name: string;
  code: string;
  /** ISO 8601. */
  until: string;
}

export interface SpecIdLookupDto extends SavedSpecIdDto {
  replacedCode: string | null;
  formerHolders: FormerHolderDto[];
}

export interface SimilarSpecIdsDto {
  fits: SavedSpecIdDto[];
  mightFit: SavedSpecIdDto[];
}

export interface SaveSpecIdInput {
  name: string;
  facts: SpecIdFactsInput;
  savedBy: StaffDto;
}

export interface UpdateSpecIdInput {
  id: string;
  name: string;
  facts: SpecIdFactsInput;
  /** The version the change was started from. */
  version: number;
  updatedBy: StaffDto;
}

export interface SavedSpecIdIdInput {
  id: string;
}

/** The library's query string, as the transport read it. */
export type ListSavedSpecIdsInput = Readonly<Record<string, unknown>>;

export interface FindSpecIdByCodeInput {
  code: string;
}

/** The query string of a similar lookup, as the transport read it: slot keys with their raw values. */
export type FindSimilarSpecIdsInput = Readonly<Record<string, unknown>>;

/**
 * A saved Spec ID read slot by slot, with the live dictionary: an approved
 * change that renames or deletes an option rewrites every saved code holding
 * it (ADR 0031), so the live dictionary reads every saved code.
 */
export function toSavedSpecIdDto(
  record: SavedSpecIdRecord,
  dictionary: Dictionary,
  manufacturerStages: ManufacturerStageCounts,
): SavedSpecIdDto {
  const { savedSpecId, savedByName, updatedByName } = record;
  const { updatedBy, updatedAt } = savedSpecId;
  return {
    ...toDecodedSpecIdDto(savedSpecId.specId, dictionary),
    dictionaryRelease: savedSpecId.dictionaryRelease,
    id: savedSpecId.id,
    name: savedSpecId.name,
    savedBy: { id: savedSpecId.savedBy, fullName: savedByName },
    savedAt: savedSpecId.savedAt.toISOString(),
    version: savedSpecId.version,
    updatedBy: updatedBy === null ? null : { id: updatedBy, fullName: updatedByName ?? '' },
    updatedAt: updatedAt === null ? null : updatedAt.toISOString(),
    manufacturerStages: { ...manufacturerStages },
  };
}

export function toFormerHolderDto({ record, until }: FormerHolderRecord): FormerHolderDto {
  return {
    id: record.savedSpecId.id,
    name: record.savedSpecId.name,
    code: record.savedSpecId.specId.code,
    until: until.toISOString(),
  };
}

/** `POST /atlas/spec-ids/read`: raw text, and a product type to read it as when the text names none (#41). */
export interface ReadSpecIdTextInput {
  text: string;
  productType?: string | undefined;
}

export interface TextReadFactDto {
  key: SlotKey;
  name: string;
  /** As the slot reads in a decoded code: "14 oz", "Molded fibre, bagasse". */
  meaning: string;
  /** As the text wrote them. */
  words: string;
  ruling: Ruling | null;
}

export interface TextConflictDto {
  key: SlotKey;
  name: string;
  /** Each value's words, as the text wrote them. */
  found: string[];
}

export interface SpecIdTextReadingDto {
  read: TextReadFactDto[];
  ignored: string[];
  conflicts: TextConflictDto[];
  /**
   * Sentences about what was read: a lid named by what it fits, two values
   * for one fact, a size converted, and what a word left over could mean
   * (plan 0011).
   */
  notes: string[];
  /** Null until a product type is found or given. */
  decoded: DecodedSpecIdDto | null;
}

/** One verified-list row's quote, each value as the workbook shows it; null when empty (ADR 0027). */
export interface ManufacturerQuoteDto {
  itemName: string | null;
  fobPerUnit: string | null;
  fobPerCase: string | null;
  fobTotal: string | null;
  moldCost: string | null;
  moldLeadTime: string | null;
  sampleLeadTime: string | null;
  productionLeadTime: string | null;
}

/** A manufacturer on one Spec ID, once, with its stage and every quote (#57). */
export interface SpecIdManufacturerDto {
  id: string;
  name: string;
  country: string | null;
  stage: Stage;
  /** The last change an admin made, if any; a cleared stage still names who cleared it. */
  stageSet: { by: StaffDto; at: string; stage: AdminStage | null } | null;
  quotes: ManufacturerQuoteDto[];
}

export interface SpecIdManufacturersDto {
  specId: { id: string; name: string; code: string };
  /** By name. */
  manufacturers: SpecIdManufacturerDto[];
}

export interface SetManufacturerStageInput {
  id: string;
  manufacturerId: string;
  /** Null clears the stage an admin set, handing it back to the quotes. */
  stage: AdminStage | null;
  by: StaffDto;
}
