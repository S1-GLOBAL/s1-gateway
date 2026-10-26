import { DomainError } from '../../../../shared/domain/domain-error.js';

/** Messages by the field of the suggestion form they belong to. */
export type SuggestionIssues = Partial<
  Record<'kind' | 'slot' | 'code' | 'newCode' | 'meaning' | 'searchWords' | 'replacement' | 'rules', string[]>
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

/** Only the suggester may edit or withdraw a suggestion; nobody decides their own. */
export class SuggestionNotAllowedError extends DomainError {
  override readonly code = 'NOT_ALLOWED';

  constructor(message = 'Only the person who suggested this can change it.') {
    super(message);
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
