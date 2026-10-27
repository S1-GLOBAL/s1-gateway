import type { Result } from '../../../../shared/domain/result.js';
import { expectedFill } from '../applicability.js';
import {
  Dictionary,
  type DictionaryChangeStamp,
  type DictionaryRename,
  type DictionarySearchWord,
  type DictionaryValue,
  type SlotRuleEntry,
} from '../dictionary.js';
import { DOES_NOT_APPLY, NOT_KNOWN, RULED_SLOTS, SLOTS, type DictionarySlotKey, type SlotKey } from '../slots.js';
import type { InvalidSpecIdError } from '../spec-id.errors.js';
import { SpecId } from '../spec-id.js';
import type { Proposal, SuggestionTarget } from './proposal.js';

/*
 * What an approved suggestion does (ADR 0031), as pure functions: the
 * dictionary it leaves, and each saved Spec ID it rewrites. Both run on a
 * proposal `checkProposal` has just passed against `dictionary`.
 */

/** Whether a slot's raw value holds an option: a capacity by its unit letter, any other slot by its code. */
export function holdsOption(value: string, slot: DictionarySlotKey, code: string): boolean {
  return slot === 'capacity' ? value.startsWith(code) : value === code;
}

/** The dictionary once `proposal` for `target` is applied, as change `stamp`. */
export function applyProposal(
  dictionary: Dictionary,
  target: SuggestionTarget,
  proposal: Proposal,
  stamp: DictionaryChangeStamp,
): Dictionary {
  const { slot, code } = target;
  let values: DictionaryValue[] = dictionary.values();
  let rules: SlotRuleEntry[] = dictionary.slotRules();
  let words: DictionarySearchWord[] = dictionary.searchWords();
  let renames: DictionaryRename[] = dictionary.renames();
  const wordsFor = (optionCode: string, list: readonly string[]): DictionarySearchWord[] =>
    list.map((word) => ({ slot, word, code: optionCode, changeNumber: stamp.number }));

  switch (proposal.kind) {
    case 'add': {
      values = [...values, { slot, code, meaning: proposal.meaning }];
      if (slot === 'productType' && proposal.rules !== null) {
        rules = [...rules, ...RULED_SLOTS.map((ruled) => ({ productType: code, slot: ruled, rule: proposal.rules![ruled] }))];
      }
      words = [...words, ...wordsFor(code, proposal.searchWords)];
      break;
    }
    case 'edit': {
      const newCode = proposal.newCode ?? code;
      values = values.map((value) =>
        value.slot === slot && value.code === code
          ? { slot, code: newCode, meaning: proposal.meaning ?? value.meaning }
          : value,
      );
      if (newCode !== code) {
        if (slot === 'productType') {
          rules = rules.map((entry) => (entry.productType === code ? { ...entry, productType: newCode } : entry));
        }
        words = words.map((word) => (word.slot === slot && word.code === code ? { ...word, code: newCode } : word));
        renames = moveRenames(renames, slot, code, newCode, stamp.number);
      }
      if (proposal.searchWords !== null) {
        words = [...words.filter((word) => !(word.slot === slot && word.code === newCode)), ...wordsFor(newCode, proposal.searchWords)];
      }
      break;
    }
    case 'delete': {
      values = values.filter((value) => !(value.slot === slot && value.code === code));
      if (slot === 'productType') rules = rules.filter((entry) => entry.productType !== code);
      words = words.filter((word) => !(word.slot === slot && word.code === code));
      renames = moveRenames(renames, slot, code, null, stamp.number);
      break;
    }
    case 'rules': {
      rules = rules.map((entry) => {
        const changed = entry.productType === code ? proposal.rules[entry.slot] : undefined;
        return changed === undefined ? entry : { ...entry, rule: changed };
      });
      break;
    }
  }

  return new Dictionary(dictionary.release, dictionary.approvedOn, values, rules, {
    renames,
    searchWords: words,
    change: stamp,
  });
}

/**
 * Points every rename that reached `from` at `to` (null when deleted), and
 * records `from` itself, so one step always reaches the live letters.
 */
function moveRenames(
  renames: readonly DictionaryRename[],
  slot: DictionarySlotKey,
  from: string,
  to: string | null,
  changeNumber: number,
): DictionaryRename[] {
  const moved = renames.map((rename) =>
    rename.slot === slot && rename.newCode === from ? { ...rename, newCode: to, changeNumber } : rename,
  );
  const own = moved.findIndex((rename) => rename.slot === slot && rename.oldCode === from);
  const entry = { slot, oldCode: from, newCode: to, changeNumber };
  if (own === -1) return [...moved, entry];
  moved[own] = entry;
  return moved;
}

/**
 * Whether approving `proposal` can rewrite a Spec ID holding `target`'s
 * option: a new code, a deletion, or a product type's rules. A new option or
 * a new wording rewrites nothing.
 */
export function rewritesSpecIds(proposal: Proposal): boolean {
  return (proposal.kind === 'edit' && proposal.newCode !== null) || proposal.kind === 'delete' || proposal.kind === 'rules';
}

/**
 * A saved Spec ID's code once `proposal` is approved: the option's code
 * replaced (renamed, or deleted for its replacement), then every ruled field
 * refitted to `next`'s rules — `X` where it no longer applies, `Y` where it now
 * applies but was `X`, `Y` where it waits on a shape or material not known.
 * The result is read again with `next`, so a rewrite never saves a code `next`
 * would refuse.
 */
export function rewriteSpecId(
  specId: SpecId,
  target: SuggestionTarget,
  proposal: Proposal,
  next: Dictionary,
): Result<SpecId, InvalidSpecIdError> {
  const values = Object.fromEntries(SLOTS.map(({ key }) => [key, specId.slot(key)])) as Record<SlotKey, string>;
  const { slot, code } = target;
  const held = holdsOption(values[slot], slot, code);

  if (held && proposal.kind === 'edit' && proposal.newCode !== null) {
    values[slot] = replaced(values[slot], slot, proposal.newCode);
  }
  if (held && proposal.kind === 'delete' && proposal.replacement !== null) {
    values[slot] = replaced(values[slot], slot, proposal.replacement);
  }

  // The shape first: the round-only and non-round-only fields read it.
  for (const key of ['shape' as const, ...RULED_SLOTS.filter((ruled) => ruled !== 'shape')]) {
    const fill = expectedFill(next, values.productType, key, values.shape, values.material);
    if (fill === null) continue;
    if (fill.fill === 'does-not-apply') values[key] = DOES_NOT_APPLY;
    else if (fill.fill === 'not-known') values[key] = NOT_KNOWN;
    else if (values[key] === DOES_NOT_APPLY) values[key] = NOT_KNOWN;
  }

  return SpecId.parse(SLOTS.map(({ key }) => values[key]).join('.'), next);
}

/** A slot's value with its option replaced: a capacity keeps its number under a new unit; Not known is `Y` alone. */
function replaced(value: string, slot: DictionarySlotKey, code: string): string {
  if (code === NOT_KNOWN) return NOT_KNOWN;
  return slot === 'capacity' ? `${code}${value.slice(1)}` : code;
}
