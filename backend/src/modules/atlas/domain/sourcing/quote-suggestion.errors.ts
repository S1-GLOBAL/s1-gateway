import { DomainError } from '../../../../shared/domain/domain-error.js';

/** Messages by the field of the quotation form they belong to. */
export type QuoteSuggestionIssues = Partial<
  Record<
    | 'specId'
    | 'manufacturer'
    | 'manufacturerName'
    | 'manufacturerCountry'
    | 'itemName'
    | 'fobPerUnit'
    | 'fobPerCase'
    | 'fobTotal'
    | 'moldCost'
    | 'moldLeadTime'
    | 'sampleLeadTime'
    | 'productionLeadTime',
    string[]
  >
>;

export class InvalidQuoteSuggestionError extends DomainError {
  override readonly code = 'VALIDATION_FAILED';

  constructor(readonly issues: QuoteSuggestionIssues) {
    super('The quotation is not valid.', { fields: issues });
  }
}

export class QuoteSuggestionNotFoundError extends DomainError {
  override readonly code = 'QUOTE_SUGGESTION_NOT_FOUND';

  constructor() {
    super('This quotation does not exist.');
  }
}

/** Only the person who added a quotation may edit or withdraw it. */
export class QuoteSuggestionNotAllowedError extends DomainError {
  override readonly code = 'NOT_ALLOWED';

  constructor() {
    super('Only the person who added this quotation can change it.');
  }
}

/** It was approved, rejected or withdrawn: it no longer waits. */
export class QuoteSuggestionDecidedError extends DomainError {
  override readonly code = 'QUOTE_SUGGESTION_DECIDED';

  constructor() {
    super('This quotation is no longer waiting. Reload it to see what happened.');
  }
}

/** Someone changed it since it was read: its `version` is not the current one. */
export class QuoteSuggestionChangedError extends DomainError {
  override readonly code = 'QUOTE_SUGGESTION_CHANGED';

  constructor() {
    super('This quotation changed since you opened it. Reload it, then try again.');
  }
}

/** Nobody approves or rejects their own quotation (ADR 0035). */
export class OwnQuoteSuggestionError extends DomainError {
  override readonly code = 'NOT_ALLOWED';

  constructor() {
    super('You added this quotation, so another admin decides it.');
  }
}
