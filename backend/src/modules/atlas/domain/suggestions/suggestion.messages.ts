/**
 * Every message a dictionary suggestion can fail with. Where issue #95's copy
 * table words one, it is worded exactly so; the form shows them as they come.
 */
export const suggestionMessages = {
  notAList: (): string => 'That is not a dictionary list.',
  codeCharacters: (): string => 'Use capital letters and digits only.',
  codeWidth: (width: number): string =>
    width === 1 ? 'A capacity unit is one capital letter.' : `The code must be ${width} characters.`,
  codeIsMarker: (code: string): string => `${code} can't be a code: it reads as "not known" or "doesn't apply".`,
  codeTaken: (code: string, meaning: string): string => `${code} is already ${meaning}.`,
  noSuchOption: (list: string, code: string): string => `${list} has no option ${code}.`,
  sameCode: (): string => 'That is the code it has now.',
  meaningEmpty: (): string => 'Write what it means.',
  meaningTooLong: (max: number): string => `Keep it to ${max} characters.`,
  nothingChanged: (): string => 'Change the code, the wording or the search words.',
  roundLocked: (): string =>
    "RD is how Atlas knows a shape is round, so its letters can't change and it can't be deleted.",
  replacementRequired: (): string => 'Pick what those Spec IDs become.',
  productTypeNotKnown: (): string => "Pick the product type they become. Product type can't be not known.",
  replacementIsItself: (): string => 'Pick a different option, or Not known.',
  rulesOnlyForProductType: (): string => 'Only a product type has field rules.',
  rulesMissing: (fields: string): string => `Say whether each field applies. Missing: ${fields}.`,
  ruleUnknown: (field: string, rule: string): string => `${field}: ${rule} is not a rule.`,
  ruleUnchanged: (field: string, rule: string): string => `${field} is already "${rule}".`,
  noRules: (): string => "Change at least one field's rule.",
  wordFormat: (word: string): string =>
    `“${word}”: use 2–40 lower-case letters, digits, spaces or hyphens.`,
  tooManyWords: (max: number): string => `An option can have at most ${max} search words.`,
  wordTaken: (word: string, code: string, meaning: string): string => `“${word}” already finds ${code} (${meaning}).`,
  targetChanged: (): string =>
    "A suggestion's kind, list and code can't change. Withdraw it and suggest again.",
  ownSuggestion: (): string => "You can't approve or reject your own suggestion.",
  reasonMissing: (suggester: string): string => `Say why, so ${suggester} knows what to change.`,
  reasonTooLong: (max: number): string => `Keep it to ${max} characters.`,
  outOfDate: (what: string): string =>
    `The dictionary changed since this was suggested: ${what}. The suggester can edit it, or you can reject it.`,
  wouldClash: (first: string, second: string): string =>
    `Approving this would make saved Spec IDs identical: ${first} and ${second}. Edit or reject the suggestion.`,
  wouldClashUnnamed: (): string =>
    'Approving this would make two saved Spec IDs identical. Edit or reject the suggestion.',
  wouldBeInvalid: (code: string, problem: string): string =>
    `Approving this would leave ${code} invalid: ${problem} Edit or reject the suggestion.`,
  dictionaryMovedOn: (): string => 'The dictionary changed while this was being approved. Try again.',
  specIdMovedOn: (): string => 'A Spec ID changed while this was being approved. Try again.',
} as const;
