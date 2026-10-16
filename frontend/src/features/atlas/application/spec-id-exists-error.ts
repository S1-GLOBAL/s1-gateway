import { AppError } from '@/shared/application/app-error';
import type { SavedSpecId } from '../domain/atlas';

/** The code is already saved. Nothing new was saved; `existing` is the Spec ID that was. */
export class SpecIdExistsError extends AppError {
  readonly existing: SavedSpecId;

  constructor(existing: SavedSpecId, message: string) {
    super('SPEC_ID_EXISTS', message);
    this.name = 'SpecIdExistsError';
    this.existing = existing;
  }
}
