import { err, ok, type Result } from '../../../../shared/domain/result.js';
import { letterOf } from '../code.js';
import type { Dictionary } from '../dictionary.js';
import { KEYWORDS } from '../reading/keywords.js';
import { WORD_LIST } from '../reading/word-list.js';
import {
  DICTIONARY_SLOTS,
  NOT_KNOWN,
  ROUND_SHAPE,
  RULED_SLOTS,
  SLOT_RULES,
  slotDefinition,
  type DictionarySlotKey,
  type RuledSlotKey,
  type SlotRule,
} from '../slots.js';
import { InvalidSuggestionError, type SuggestionIssues } from './suggestion.errors.js';
import { suggestionMessages as messages } from './suggestion.messages.js';

/*
 * What a suggestion asks for, and every rule it must meet (#95). The rules are
 * checked when it is made, when it is edited, and again when it is approved,
 * against the dictionary as it is at that moment.
 */

export type SuggestionKind = 'add' | 'edit' | 'delete' | 'rules';

/**
 * The option a suggestion is about, by its key (its number, as text), the
 * product type for `rules`. Empty for `add`: a new option is numbered when it
 * is approved (ADR 0033).
 */
export interface SuggestionTarget {
  readonly slot: DictionarySlotKey;
  readonly code: string;
}

export type RuleChanges = Readonly<Partial<Record<RuledSlotKey, SlotRule>>>;

export interface AddProposal {
  readonly kind: 'add';
  readonly meaning: string;
  readonly searchWords: readonly string[];
  /** Every ruled field's rule, for a new product type; null for any other list. */
  readonly rules: Readonly<Record<RuledSlotKey, SlotRule>> | null;
  /** For a new material, the material it is a grade of; null or left out for none (ADR 0033). */
  readonly broader?: string | null;
}

export interface EditProposal {
  readonly kind: 'edit';
  /**
   * Null leaves each as it is; at least one is not null. A new code is
   * refused since options are known by number (ADR 0033), and is kept only
   * as suggestions made before wrote it.
   */
  readonly newCode: string | null;
  readonly meaning: string | null;
  /** The whole new list, replacing today's. */
  readonly searchWords: readonly string[] | null;
}

export interface DeleteProposal {
  readonly kind: 'delete';
  /** What saved Spec IDs using the option become: another option's key, `Y`, or null when none uses it. */
  readonly replacement: string | null;
}

export interface RulesProposal {
  readonly kind: 'rules';
  readonly rules: RuleChanges;
}

export type Proposal = AddProposal | EditProposal | DeleteProposal | RulesProposal;

/** What a proposal is checked against: the live dictionary, with its approved search words. */
export interface ProposalContext {
  readonly dictionary: Dictionary;
  /** How many saved Spec IDs hold the target option. */
  readonly usage: number;
}

export const MEANING_MAX_LENGTH = 120;
export const SEARCH_WORDS_MAX = 20;

const RULE_LABELS: Record<SlotRule, string> = {
  applies: 'Applies',
  never: 'Never',
  round_only: 'Round only',
  non_round_only: 'Non-round only',
  paper_only: 'Paper family only',
};

const LIST_NAMES = Object.fromEntries(DICTIONARY_SLOTS.map((slot) => [slot, slotDefinition(slot).name])) as Record<
  DictionarySlotKey,
  string
>;

export function isDictionarySlot(value: string): value is DictionarySlotKey {
  return (DICTIONARY_SLOTS as readonly string[]).includes(value);
}

/**
 * Whether `code` could be an option's key: a whole number from 1, as text;
 * a capacity unit's one digit, as a code writes it after `G` (ADR 0032, ADR 0033).
 */
export function isOptionCode(slot: DictionarySlotKey, code: string): boolean {
  return (slot === 'capacity' ? /^[1-9]$/ : /^[1-9]\d*$/).test(code);
}

/** An option's key as given: trimmed. */
export function normaliseCode(code: string): string {
  return code.trim();
}

/** A search word as the reader compares text: trimmed, lower case, one space between words. */
export function normaliseWord(word: string): string {
  return word.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Checks `proposal` for `target` and answers it tidied (keys and wording trimmed, search words normalised and without repeats), or every
 * problem at once, by field, so a form can show them all.
 */
export function checkProposal(
  target: SuggestionTarget,
  proposal: Proposal,
  context: ProposalContext,
): Result<{ target: SuggestionTarget; proposal: Proposal }, InvalidSuggestionError> {
  const issues: SuggestionIssues = {};
  const add = (field: keyof SuggestionIssues, message: string) => {
    issues[field] = [...(issues[field] ?? []), message];
  };

  if (!isDictionarySlot(target.slot)) {
    add('slot', messages.notAList());
    return err(new InvalidSuggestionError(issues));
  }

  const slot = target.slot;
  const code = normaliseCode(target.code);
  const { dictionary } = context;
  const exists = dictionary.meaningOf(slot, code) !== undefined;
  const tidied = tidy(proposal);

  switch (tidied.kind) {
    case 'add': {
      if (code !== '') add('code', messages.codeIsNumbered());
      if (slot === 'capacity' && dictionary.nextNumber(slot) > CAPACITY_UNITS_MAX) add('code', messages.capacityUnitsFull(CAPACITY_UNITS_MAX));
      for (const problem of meaningProblems(tidied.meaning)) add('meaning', problem);
      for (const problem of broaderProblems(slot, tidied.broader ?? null, dictionary)) add('broader', problem);
      for (const problem of wordProblems(slot, code, tidied.searchWords, context)) add('searchWords', problem);
      if (slot === 'productType') {
        for (const problem of fullRulesProblems(tidied.rules)) add('rules', problem);
      } else if (tidied.rules !== null) {
        add('rules', messages.rulesOnlyForProductType());
      }
      break;
    }
    case 'edit': {
      if (!exists) {
        add('code', messages.noSuchOption(LIST_NAMES[slot], code));
        break;
      }
      if (tidied.newCode !== null) add('newCode', messages.codeIsNumbered());
      else if (tidied.meaning === null && tidied.searchWords === null) add('code', messages.nothingChanged());
      if (tidied.meaning !== null) for (const problem of meaningProblems(tidied.meaning)) add('meaning', problem);
      if (tidied.searchWords !== null) {
        for (const problem of wordProblems(slot, code, tidied.searchWords, context)) add('searchWords', problem);
      }
      break;
    }
    case 'delete': {
      if (!exists) {
        add('code', messages.noSuchOption(LIST_NAMES[slot], code));
        break;
      }
      if (isRound(slot, code)) {
        add('code', messages.roundLocked());
        break;
      }
      for (const problem of replacementProblems(slot, code, tidied.replacement, context)) add('replacement', problem);
      break;
    }
    case 'rules': {
      if (slot !== 'productType') {
        add('rules', messages.rulesOnlyForProductType());
        break;
      }
      if (!exists) {
        add('code', messages.noSuchOption(LIST_NAMES[slot], code));
        break;
      }
      for (const problem of ruleChangeProblems(code, tidied.rules, dictionary)) add('rules', problem);
      break;
    }
  }

  if (Object.keys(issues).length > 0) return err(new InvalidSuggestionError(issues));
  return ok({ target: { slot, code }, proposal: tidied });
}

function tidy(proposal: Proposal): Proposal {
  switch (proposal.kind) {
    case 'add':
      return {
        ...proposal,
        meaning: proposal.meaning.trim(),
        searchWords: uniqueWords(proposal.searchWords),
        broader: proposal.broader == null ? null : normaliseCode(proposal.broader),
      };
    case 'edit':
      return {
        ...proposal,
        newCode: proposal.newCode === null ? null : normaliseCode(proposal.newCode),
        meaning: proposal.meaning === null ? null : proposal.meaning.trim(),
        searchWords: proposal.searchWords === null ? null : uniqueWords(proposal.searchWords),
      };
    case 'delete':
      return { ...proposal, replacement: proposal.replacement === null ? null : normaliseCode(proposal.replacement) };
    case 'rules':
      return proposal;
  }
}

function uniqueWords(words: readonly string[]): string[] {
  return [...new Set(words.map(normaliseWord).filter((word) => word !== ''))];
}

function isRound(slot: DictionarySlotKey, code: string): boolean {
  return slot === 'shape' && code === ROUND_SHAPE;
}

/** A capacity unit's number is one digit after `G` in a code (ADR 0032). */
const CAPACITY_UNITS_MAX = 9;

/** A new option's broader material: a material the dictionary has, for a material only. */
function broaderProblems(slot: DictionarySlotKey, broader: string | null, dictionary: Dictionary): string[] {
  if (broader === null) return [];
  if (slot !== 'material') return [messages.broaderOnlyForMaterial()];
  return dictionary.meaningOf('material', broader) === undefined ? [messages.noSuchOption(LIST_NAMES.material, broader)] : [];
}

function meaningProblems(meaning: string): string[] {
  if (meaning === '') return [messages.meaningEmpty()];
  if (meaning.length > MEANING_MAX_LENGTH) return [messages.meaningTooLong(MEANING_MAX_LENGTH)];
  return [];
}

function wordProblems(
  slot: DictionarySlotKey,
  code: string,
  words: readonly string[],
  context: ProposalContext,
): string[] {
  const problems: string[] = [];
  if (words.length > SEARCH_WORDS_MAX) problems.push(messages.tooManyWords(SEARCH_WORDS_MAX));
  for (const word of words) {
    if (!/^[a-z0-9]+(?:[ -][a-z0-9]+)*$/.test(word) || word.length < 2 || word.length > 40) {
      problems.push(messages.wordFormat(word));
      continue;
    }
    const finds = whoFinds(slot, word, context);
    if (finds !== undefined && finds !== code) {
      problems.push(messages.wordTaken(word, `${letterOf(slot)}${finds}`, context.dictionary.meaningOf(slot, finds) ?? finds));
    }
  }
  return problems;
}

/**
 * The code a whole phrase already reads as in `slot`, if any: the code's
 * word list, a product type's own name, a keyword whose value is fixed, or an
 * approved search word (ADR 0026). Two codes for one phrase would leave the
 * slot not known, so a word another option has is refused.
 */
export function whoFinds(slot: DictionarySlotKey, word: string, context: ProposalContext): string | undefined {
  // The word list and the keywords name options by number (`options.ts`): a deleted option's word finds
  // nothing, so an approved word may still have it (ADR 0031).
  const live = (code: string) => context.dictionary.live(slot, code);
  const listed = WORD_LIST[word];
  if (listed !== undefined) {
    const entry = 'productType' in listed ? { slot: 'productType', code: listed.productType } : { slot: 'material', code: listed.material };
    const code = entry.slot === slot ? live(entry.code) : undefined;
    if (code !== undefined) return code;
  }
  if (slot === 'productType') {
    const named = context.dictionary.valuesOf('productType').find((value) => value.meaning.toLowerCase() === word);
    if (named !== undefined) return named.code;
  }
  for (const keyword of KEYWORDS) {
    if (keyword.slot !== slot || typeof keyword.value !== 'string') continue;
    const pattern = new RegExp(keyword.pattern.source, keyword.pattern.flags.replace('g', ''));
    const code = pattern.exec(word)?.[0] === word ? live(keyword.value) : undefined;
    if (code !== undefined) return code;
  }
  return context.dictionary.searchWords().find((approved) => approved.slot === slot && approved.word === word)?.code;
}

function replacementProblems(
  slot: DictionarySlotKey,
  code: string,
  replacement: string | null,
  context: ProposalContext,
): string[] {
  if (replacement === null) {
    if (context.usage === 0) return [];
    return [slot === 'productType' ? messages.productTypeNotKnown() : messages.replacementRequired()];
  }
  if (replacement === NOT_KNOWN) return slot === 'productType' ? [messages.productTypeNotKnown()] : [];
  if (replacement === code) return [messages.replacementIsItself()];
  if (context.dictionary.meaningOf(slot, replacement) === undefined) {
    return [messages.noSuchOption(LIST_NAMES[slot], replacement)];
  }
  return [];
}

function fullRulesProblems(rules: Readonly<Partial<Record<RuledSlotKey, SlotRule>>> | null): string[] {
  const given = rules ?? {};
  const problems = unknownRules(given);
  const missing = RULED_SLOTS.filter((slot) => given[slot] === undefined);
  if (missing.length > 0) problems.push(messages.rulesMissing(missing.map((slot) => slotDefinition(slot).name).join(', ')));
  return problems;
}

function ruleChangeProblems(productType: string, rules: RuleChanges, dictionary: Dictionary): string[] {
  const entries = Object.entries(rules) as [string, string][];
  if (entries.length === 0) return [messages.noRules()];
  const problems = unknownRules(rules);
  for (const [slot, rule] of entries) {
    if (!isRuledSlot(slot) || !isRule(rule)) continue;
    if (dictionary.ruleFor(productType, slot) === rule) {
      problems.push(messages.ruleUnchanged(slotDefinition(slot).name, RULE_LABELS[rule]));
    }
  }
  return problems;
}

function unknownRules(rules: Readonly<Record<string, string | undefined>>): string[] {
  const problems: string[] = [];
  for (const [slot, rule] of Object.entries(rules)) {
    if (rule === undefined) continue;
    if (!isRuledSlot(slot)) problems.push(messages.ruleUnknown(slot, rule));
    else if (!isRule(rule)) problems.push(messages.ruleUnknown(slotDefinition(slot).name, rule));
  }
  return problems;
}

function isRuledSlot(value: string): value is RuledSlotKey {
  return (RULED_SLOTS as readonly string[]).includes(value);
}

function isRule(value: string): value is SlotRule {
  return (SLOT_RULES as readonly string[]).includes(value);
}

export const REASON_MAX_LENGTH = 500;

/** A rejection's reason, trimmed, or why it can't be one: it says the suggester's name (#95). */
export function checkReason(reason: string, suggesterName: string): Result<string, InvalidSuggestionError> {
  const trimmed = reason.trim();
  if (trimmed === '') return err(new InvalidSuggestionError({ reason: [messages.reasonMissing(suggesterName)] }));
  if (trimmed.length > REASON_MAX_LENGTH) {
    return err(new InvalidSuggestionError({ reason: [messages.reasonTooLong(REASON_MAX_LENGTH)] }));
  }
  return ok(trimmed);
}
