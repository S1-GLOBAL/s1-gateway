import { AppError } from '@/shared/application/app-error';

/** Someone saved a change to this Spec ID after this one was started. Nothing was saved. */
export class SpecIdChangedError extends AppError {
  constructor(message: string) {
    super('SPEC_ID_CHANGED', message);
    this.name = 'SpecIdChangedError';
  }
}
