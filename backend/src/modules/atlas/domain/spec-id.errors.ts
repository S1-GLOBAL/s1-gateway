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
