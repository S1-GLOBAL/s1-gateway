import { DomainError } from '../../../shared/domain/domain-error.js';
import type { SlotKey } from './slots.js';

/** Messages by slot key; problems with the whole code under `code`, with the name under `name`. */
export type SpecIdIssues = Partial<Record<SlotKey | 'code' | 'name', string[]>>;

export class InvalidSpecIdError extends DomainError {
  override readonly code = 'INVALID_SPEC_ID';

  constructor(readonly issues: SpecIdIssues) {
    super('The Spec ID is not valid.', { fields: issues });
  }
}

/** The code is already saved. `existing` is the saved Spec ID, when the caller has it. */
export class SpecIdExistsError extends DomainError {
  override readonly code = 'SPEC_ID_EXISTS';

  constructor(readonly existing?: object) {
    super('This Spec ID already exists. Nothing new was saved.', existing === undefined ? undefined : { existing });
  }
}

export class SpecIdNotFoundError extends DomainError {
  override readonly code = 'SPEC_ID_NOT_FOUND';

  constructor() {
    super('No saved Spec ID has this code. Check it, or build and save it.');
  }
}

/** A similar lookup asked about something that is not a slot, or a value a slot cannot hold. Issues are keyed as asked. */
export class InvalidLookupError extends DomainError {
  override readonly code = 'VALIDATION_FAILED';

  constructor(readonly issues: Readonly<Record<string, string[]>>) {
    super('The lookup is not valid.', { fields: issues });
  }
}
