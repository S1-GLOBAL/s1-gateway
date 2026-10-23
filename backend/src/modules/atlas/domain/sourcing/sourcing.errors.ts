import { DomainError } from '../../../../shared/domain/domain-error.js';

/** The manufacturer has no quote on this Spec ID, so it has no stage there to set. */
export class ManufacturerNotFoundError extends DomainError {
  override readonly code = 'MANUFACTURER_NOT_FOUND';

  constructor() {
    super('This manufacturer has no quote on this Spec ID.');
  }
}
