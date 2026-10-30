import { DomainError } from '../../../../shared/domain/domain-error.js';
import { suggestionMessages as messages } from './suggestion.messages.js';

/** Messages by the field of the suggestion form they belong to. */
export type SuggestionIssues = Partial<
  Record<'kind' | 'slot' | 'code' | 'newCode' | 'meaning' | 'searchWords' | 'broader' | 'replacement' | 'rules' | 'reason', string[]>
>;

export class InvalidSuggestionError extends DomainError {
  override readonly code = 'VALIDATION_FAILED';

  constructor(readonly issues: SuggestionIssues) {
    super('The suggestion is not valid.', { fields: issues });
  }
}

export class SuggestionNotFoundError extends DomainError {
  override readonly code = 'SUGGESTION_NOT_FOUND';

  constructor() {
    super('This suggestion does not exist.');
  }
}

/** Only the suggester may edit or withdraw a suggestion. */
export class SuggestionNotAllowedError extends DomainError {
  override readonly code = 'NOT_ALLOWED';

  constructor() {
    super('Only the person who suggested this can change it.');
  }
}

/** It was approved, rejected or withdrawn: it no longer waits. */
export class SuggestionDecidedError extends DomainError {
  override readonly code = 'SUGGESTION_DECIDED';

  constructor() {
    super('This suggestion is no longer waiting. Reload it to see what happened.');
  }
}

/** Someone changed it since it was read: its `version` is not the current one. */
export class SuggestionChangedError extends DomainError {
  override readonly code = 'SUGGESTION_CHANGED';

  constructor() {
    super('This suggestion changed since you opened it. Reload it, then try again.');
  }
}

/** Nobody approves or rejects their own suggestion (#95). */
export class OwnSuggestionError extends DomainError {
  override readonly code = 'NOT_ALLOWED';

  constructor() {
    super(messages.ownSuggestion());
  }
}

/** Checked again on approval, the suggestion no longer fits the live dictionary. `issues` are by field. */
export class SuggestionOutOfDateError extends DomainError {
  override readonly code = 'SUGGESTION_OUT_OF_DATE';

  constructor(readonly issues: SuggestionIssues) {
    const what = Object.values(issues).flat().map((message) => message.replace(/\.$/, '')).join('; ');
    super(messages.outOfDate(what), { fields: issues });
  }
}

/** Approving would give two saved Spec IDs one code. `codes` are their codes now, when known. */
export class SpecIdsWouldClashError extends DomainError {
  override readonly code = 'SPEC_IDS_WOULD_CLASH';

  constructor(readonly codes?: readonly [string, string]) {
    super(codes ? messages.wouldClash(codes[0], codes[1]) : messages.wouldClashUnnamed(), codes ? { codes } : undefined);
  }
}

/** Approving would leave a saved Spec ID a code the new dictionary refuses: `code` is its code now. */
export class SpecIdWouldBeInvalidError extends DomainError {
  override readonly code = 'SPEC_ID_WOULD_BE_INVALID';

  constructor(
    readonly specIdCode: string,
    problem: string,
  ) {
    super(messages.wouldBeInvalid(specIdCode, problem), { code: specIdCode });
  }
}

/** Another approval landed while this one was being made: nothing of this one was saved. */
export class DictionaryMovedOnError extends DomainError {
  override readonly code = 'DICTIONARY_CHANGED';

  constructor() {
    super(messages.dictionaryMovedOn());
  }
}

/** Someone changed a Spec ID this approval rewrites while it was being made: nothing was saved. */
export class SpecIdMovedOnError extends DomainError {
  override readonly code = 'SPEC_ID_CHANGED';

  constructor() {
    super(messages.specIdMovedOn());
  }
}
