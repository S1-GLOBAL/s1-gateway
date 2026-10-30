import type { Result } from '../../../../shared/domain/result.js';
import { expectedFill } from '../applicability.js';
import {
  Dictionary,
  type DictionaryChangeStamp,
  type DictionaryRetiredNumber,
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

/** Whether a slot's raw value holds an option: a capacity by its unit's number, any other slot by the option's. */
export function holdsOption(value: string, slot: DictionarySlotKey, code: string): boolean {
  return slot === 'capacity' ? value.startsWith(code) : value === code;
}

/**
 * The dictionary once `proposal` for `target` is applied, as change `stamp`.
 * A new option takes the next number in its list, as its key (ADR 0032, ADR
 * 0033); `target.code` names it only for the other kinds.
 */
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
  let retired: DictionaryRetiredNumber[] = dictionary.retired();
  const wordsFor = (optionCode: string, list: readonly string[]): DictionarySearchWord[] =>
    list.map((word) => ({ slot, word, code: optionCode, changeNumber: stamp.number }));

  switch (proposal.kind) {
    case 'add': {
      const number = dictionary.nextNumber(slot);
      const added = String(number);
      const broader = slot === 'material' && proposal.broader != null ? { broader: proposal.broader } : {};
      values = [...values, { slot, code: added, meaning: proposal.meaning, number, ...broader }];
      if (slot === 'productType' && proposal.rules !== null) {
        rules = [...rules, ...RULED_SLOTS.map((ruled) => ({ productType: added, slot: ruled, rule: proposal.rules![ruled] }))];
      }
      words = [...words, ...wordsFor(added, proposal.searchWords)];
      break;
    }
    case 'edit': {
      // An option's number never changes (ADR 0033): only its wording and search words do.
      values = values.map((value) =>
        value.slot === slot && value.code === code ? { ...value, meaning: proposal.meaning ?? value.meaning } : value,
      );
      if (proposal.searchWords !== null) {
        words = [...words.filter((word) => !(word.slot === slot && word.code === code)), ...wordsFor(code, proposal.searchWords)];
      }
      break;
    }
    case 'delete': {
      // Its number is never given again, and a code written with it, or with its old letters, still reads (ADR 0032, ADR 0033).
      const deleted = values.find((value) => value.slot === slot && value.code === code);
      if (deleted?.number !== undefined) {
        const legacy = deleted.legacyCode === undefined ? {} : { legacyCode: deleted.legacyCode };
        retired = [...retired, { slot, number: deleted.number, code, meaning: deleted.meaning, changeNumber: stamp.number, ...legacy }];
      }
      // Its grades become grades of what it was a grade of.
      values = values
        .filter((value) => !(value.slot === slot && value.code === code))
        .map((value) => {
          if (value.slot !== slot || value.broader !== code) return value;
          const { broader: _deleted, ...rest } = value;
          return deleted?.broader === undefined ? rest : { ...rest, broader: deleted.broader };
        });
      if (slot === 'productType') rules = rules.filter((entry) => entry.productType !== code);
      words = words.filter((word) => !(word.slot === slot && word.code === code));
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
    renames: dictionary.renames(),
    searchWords: words,
    retired,
    change: stamp,
  });
}

/**
 * Whether approving `proposal` can rewrite a Spec ID holding `target`'s
 * option: a deletion, or a product type's rules. A new option, a new wording
 * or new search words rewrite nothing.
 */
export function rewritesSpecIds(proposal: Proposal): boolean {
  return proposal.kind === 'delete' || proposal.kind === 'rules';
}

/**
 * A saved Spec ID's code once `proposal` is approved: a deleted option
 * replaced by its replacement, then every ruled field
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

  return SpecId.fromSlots(values, next);
}

/** A slot's value with its option replaced: a capacity keeps its number under a new unit; Not known is `Y` alone. */
function replaced(value: string, slot: DictionarySlotKey, code: string): string {
  if (code === NOT_KNOWN) return NOT_KNOWN;
  return slot === 'capacity' ? `${code}${value.slice(1)}` : code;
}
