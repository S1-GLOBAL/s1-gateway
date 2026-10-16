import type { Dictionary } from '../domain/dictionary.js';
import type { SlotState, SpecId, SpecIdFactsInput } from '../domain/spec-id.js';
import type { SavedSpecIdRecord } from '../domain/spec-id-repository.js';
import { DICTIONARY_SLOTS, slotDefinition, type SlotKey, type SlotRule } from '../domain/slots.js';

/** The dictionary as the application hands it outward. */
export interface DictionaryDto {
  release: string;
  /** `YYYY-MM-DD`. */
  approvedOn: string;
  /** The seven slots whose values the dictionary holds, in code order. */
  slots: DictionarySlotDto[];
  /** By product type code, then slot order. */
  rules: SlotRuleEntryDto[];
}

export interface DictionarySlotDto {
  key: SlotKey;
  name: string;
  values: DictionaryValueDto[];
}

export interface DictionaryValueDto {
  code: string;
  meaning: string;
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
  /** Always 18, in code order. */
  slots: DecodedSlotDto[];
}

export interface DecodedSlotDto {
  number: number;
  key: SlotKey;
  name: string;
  raw: string;
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
      values: dictionary.valuesOf(key).map(({ code, meaning }) => ({ code, meaning })),
    })),
    rules: dictionary.slotRules().map(({ productType, slot, rule }) => ({ productType, slot, rule })),
  };
}

export function toDecodedSpecIdDto(specId: SpecId, dictionary: Dictionary): DecodedSpecIdDto {
  return {
    code: specId.code,
    dictionaryRelease: dictionary.release,
    slots: specId.describe(dictionary).map((slot) => ({
      number: slot.number,
      key: slot.key,
      name: slot.name,
      raw: slot.raw,
      state: slot.state,
      meaning: slot.meaning,
    })),
  };
}

/** A Spec ID someone saved, with its name and who saved it when. */
export interface SavedSpecIdDto extends DecodedSpecIdDto {
  name: string;
  savedBy: { id: string; fullName: string };
  /** ISO 8601. */
  savedAt: string;
}

export interface SimilarSpecIdsDto {
  fits: SavedSpecIdDto[];
  mightFit: SavedSpecIdDto[];
}

export interface SaveSpecIdInput {
  name: string;
  facts: SpecIdFactsInput;
  savedBy: { id: string; fullName: string };
}

export interface FindSpecIdByCodeInput {
  code: string;
}

/** The query string of a similar lookup, as the transport read it: slot keys with their raw values. */
export type FindSimilarSpecIdsInput = Readonly<Record<string, unknown>>;

/**
 * A saved Spec ID read slot by slot. Meanings are never reassigned between
 * releases (ADR 0021), so the current dictionary reads every saved code.
 */
export function toSavedSpecIdDto(record: SavedSpecIdRecord, dictionary: Dictionary): SavedSpecIdDto {
  const { savedSpecId, savedByName } = record;
  return {
    ...toDecodedSpecIdDto(savedSpecId.specId, dictionary),
    dictionaryRelease: savedSpecId.dictionaryRelease,
    name: savedSpecId.name,
    savedBy: { id: savedSpecId.savedBy, fullName: savedByName },
    savedAt: savedSpecId.savedAt.toISOString(),
  };
}
