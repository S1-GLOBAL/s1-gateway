import { SLOT_NAMES, type AtlasDictionary, type SlotKey, type SlotRule } from './atlas';
import { optionCode } from './code-letters';
import type { Proposal, Suggestion } from './suggestion';

/*
 * The suggestion form's rules, kept apart from React (#95, ADR 0031): what it
 * starts with, what it sends, and the words it shows. The server checks every
 * rule again; the form only shapes what was typed into a proposal.
 */

/**
 * What a form is about: a new option for a list, an option to edit or
 * delete, or a product type's field rules. A new option has no number until
 * it is approved (ADR 0033).
 */
export type SuggestionTarget =
  | { kind: 'add'; slot: SlotKey }
  | { kind: 'edit' | 'delete'; slot: SlotKey; code: string }
  | { kind: 'rules'; slot: 'productType'; code: string };

/** What a waiting suggestion is about, to edit it in the same form. */
export function suggestionTarget(suggestion: Suggestion): SuggestionTarget {
  const { slot, code } = suggestion;
  switch (suggestion.kind) {
    case 'add':
      return { kind: 'add', slot };
    case 'edit':
    case 'delete':
      return { kind: suggestion.kind, slot, code };
    case 'rules':
      return { kind: 'rules', slot: 'productType', code };
  }
}

/** #95's words for the form, exactly. */
export const SUGGESTION_COPY = {
  sent: 'Suggested. An admin will review it.',
  roundLocked: "Round is how Atlas knows a shape is round, so it can't be deleted.",
  numbered: 'It is numbered when an admin approves it: the next number in this list.',
  broaderLabel: 'A grade of',
  broaderHint: 'The broader material, if it is one kind of it: recycled kraft is a grade of kraft.',
  noBroader: 'None',
  searchWordsLabel: 'Search words',
  searchWordsHint: 'One per line. Words people paste that mean this, like “sugarcane fibre”.',
  replacementQuestion: 'What should those Spec IDs become?',
  productTypeReplacement: "Pick the product type they become. Product type can't be not known.",
  notKnown: 'Not known (Y)',
} as const;

/** What the form holds while it is being filled in. */
export interface SuggestionDraft {
  meaning: string;
  /** Search words as typed, one per line. */
  words: string;
  /** What saved Spec IDs become on a delete: a code, `Y`, or `''` while none is chosen. */
  replacement: string;
  /** A product type's rule for each ruled field. */
  rules: Partial<Record<SlotKey, SlotRule>>;
  /** A new material's broader material, by key; `''` for none. */
  broader: string;
}

/** What the form reads besides the draft: the live dictionary, the option's approved search words and its use. */
export interface DraftContext {
  dictionary: AtlasDictionary;
  currentWords: readonly string[];
  /** How many saved Spec IDs hold the option. */
  usage: number;
}

/** Round, shape 1: Atlas reads round-only fields by it, so it can't be deleted (#95). */
export function isRoundShape(slot: SlotKey, code: string): boolean {
  return slot === 'shape' && code === '1';
}

/** Search words as typed, one per line: trimmed, single-spaced, blank lines left out. */
export function readSearchWords(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .filter((line) => line !== '');
}

export function listName(dictionary: AtlasDictionary, slot: SlotKey): string {
  return dictionary.slots.find((entry) => entry.key === slot)?.name ?? SLOT_NAMES.find((entry) => entry.key === slot)?.name ?? slot;
}

export function meaningOf(dictionary: AtlasDictionary, slot: SlotKey, code: string): string | undefined {
  return dictionary.slots.find((entry) => entry.key === slot)?.values.find((value) => value.code === code)?.meaning;
}

/** The fields a product type's rules cover, in code order. */
export function ruledSlots(dictionary: AtlasDictionary): readonly { key: SlotKey; name: string }[] {
  return SLOT_NAMES.filter((slot) => dictionary.rules.some((entry) => entry.slot === slot.key));
}

/** One product type's rules today, by field. */
export function rulesOf(dictionary: AtlasDictionary, productType: string): Partial<Record<SlotKey, SlotRule>> {
  const rules: Partial<Record<SlotKey, SlotRule>> = {};
  for (const entry of dictionary.rules) if (entry.productType === productType) rules[entry.slot] = entry.rule;
  return rules;
}

/** What a deleted option's Spec IDs can become: every other option, then Not known, which Product type has not. */
export function replacementOptions(dictionary: AtlasDictionary, slot: SlotKey, code: string): { value: string; label: string }[] {
  const values = dictionary.slots.find((entry) => entry.key === slot)?.values ?? [];
  const others = values
    .filter((value) => value.code !== code)
    .map((value) => ({ value: value.code, label: `${optionCode(slot, value.code)} — ${value.meaning}` }));
  return slot === 'productType' ? others : [...others, { value: 'Y', label: SUGGESTION_COPY.notKnown }];
}

/** What a new material can be a grade of: none, then every material. */
export function broaderOptions(dictionary: AtlasDictionary): { value: string; label: string }[] {
  const materials = dictionary.slots.find((entry) => entry.key === 'material')?.values ?? [];
  return [
    { value: '', label: SUGGESTION_COPY.noBroader },
    ...materials.map((value) => ({ value: value.code, label: `${optionCode('material', value.code)} — ${value.meaning}` })),
  ];
}

/**
 * Where the form starts: the option as the dictionary has it now, or, when a
 * waiting suggestion is being edited, what it asks for.
 */
export function startDraft(target: SuggestionTarget, context: DraftContext, editing: Proposal | null): SuggestionDraft {
  const { dictionary } = context;
  const empty: SuggestionDraft = { meaning: '', words: '', replacement: '', rules: {}, broader: '' };
  switch (target.kind) {
    case 'add': {
      const proposal = editing?.kind === 'add' ? editing : null;
      const firstProductType = dictionary.slots.find((entry) => entry.key === 'productType')?.values[0]?.code ?? '';
      return {
        ...empty,
        meaning: proposal?.meaning ?? '',
        broader: proposal?.broader ?? '',
        words: (proposal?.searchWords ?? []).join('\n'),
        rules: target.slot === 'productType' ? { ...(proposal?.rules ?? rulesOf(dictionary, firstProductType)) } : {},
      };
    }
    case 'edit': {
      const proposal = editing?.kind === 'edit' ? editing : null;
      return {
        ...empty,
        meaning: proposal?.meaning ?? meaningOf(dictionary, target.slot, target.code) ?? '',
        words: (proposal?.searchWords ?? context.currentWords).join('\n'),
      };
    }
    case 'delete': {
      const proposal = editing?.kind === 'delete' ? editing : null;
      return { ...empty, replacement: proposal?.replacement ?? '' };
    }
    case 'rules': {
      const proposal = editing?.kind === 'rules' ? editing : null;
      return { ...empty, rules: { ...rulesOf(dictionary, target.code), ...proposal?.rules } };
    }
  }
}

const sameWords = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((word, index) => word.toLowerCase() === b[index]?.toLowerCase());

/**
 * What the draft asks for. An edit sends only what differs from the option
 * today, and its search words as the whole new list; a rules change sends only
 * the rules that differ.
 */
export function draftProposal(target: SuggestionTarget, draft: SuggestionDraft, context: DraftContext): Proposal {
  const { dictionary } = context;
  switch (target.kind) {
    case 'add':
      return {
        kind: 'add',
        meaning: draft.meaning,
        searchWords: readSearchWords(draft.words),
        rules: target.slot === 'productType' ? { ...draft.rules } : null,
        ...(target.slot === 'material' ? { broader: draft.broader === '' ? null : draft.broader } : {}),
      };
    case 'edit': {
      const words = readSearchWords(draft.words);
      return {
        kind: 'edit',
        newCode: null,
        meaning: draft.meaning.trim() === (meaningOf(dictionary, target.slot, target.code) ?? '') ? null : draft.meaning,
        searchWords: sameWords(words, context.currentWords) ? null : words,
      };
    }
    case 'delete':
      return { kind: 'delete', replacement: context.usage === 0 || draft.replacement === '' ? null : draft.replacement };
    case 'rules': {
      const today = rulesOf(dictionary, target.code);
      const changed: Partial<Record<SlotKey, SlotRule>> = {};
      for (const [slot, rule] of Object.entries(draft.rules) as [SlotKey, SlotRule][]) if (today[slot] !== rule) changed[slot] = rule;
      return { kind: 'rules', rules: changed };
    }
  }
}

/** The option a suggestion is sent about, by key: none for an add, which is numbered on approval. */
export function targetCode(target: SuggestionTarget): string {
  return target.kind === 'add' ? '' : target.code;
}

/** The form's title. */
export function suggestionTitle(target: SuggestionTarget, dictionary: AtlasDictionary): string {
  switch (target.kind) {
    case 'add':
      return `Suggest an option for ${listName(dictionary, target.slot)}`;
    case 'edit':
      return `Suggest an edit to ${optionCode(target.slot, target.code)}`;
    case 'delete':
      return `Suggest deleting ${optionCode(target.slot, target.code)}`;
    case 'rules':
      return `Suggest rule changes for ${optionCode(target.slot, target.code)}`;
  }
}

/** The form's first line: the option it is about, and that nothing changes yet. */
export function suggestionIntro(target: SuggestionTarget, dictionary: AtlasDictionary): string {
  const waits = 'Nothing changes until an admin approves it.';
  if (target.kind === 'add') return `${listName(dictionary, target.slot)}. ${waits}`;
  const meaning = meaningOf(dictionary, target.slot, target.code);
  return `${listName(dictionary, target.slot)}, ${optionCode(target.slot, target.code)}${meaning ? ` (${meaning})` : ''}. ${waits}`;
}
