import { Link } from 'react-router-dom';
import { isSignInRequired } from '@/features/accounts';
import { SpecIdExistsError } from '../application/spec-id-exists-error';
import type { useSaveSpecId } from '../application/use-save-spec-id';
import { formatSavedDate } from '../domain/format-saved-date';
import { Alert } from './workspace/Alert';

/**
 * What a refused save says, wherever a Spec ID is saved: the Spec ID that
 * already has the code, with the way to it; that the session has ended; or
 * the failure's own message. Name and slot problems belong beside their
 * controls, so they are not repeated here.
 */
export function SaveOutcome({ error, timeZone }: { error: ReturnType<typeof useSaveSpecId>['error']; timeZone?: string }) {
  if (error instanceof SpecIdExistsError) {
    const { existing } = error;
    return (
      <div role="status" className="flex flex-col gap-2 text-sm text-ink">
        <p>
          {`This Spec ID already exists, saved as "${existing.name}" by ${existing.savedBy.fullName} on ${formatSavedDate(existing.savedAt, timeZone)}. Nothing new was saved.`}
        </p>
        <Link
          to={`/atlas/${existing.id}`}
          className="self-start font-medium text-accent-ink underline-offset-4 hover:underline"
        >
          Open
        </Link>
      </div>
    );
  }
  if (isSignInRequired(error)) return <Alert message="Sign in to save Spec IDs." />;
  if (error && error.code !== 'INVALID_SPEC_ID') return <Alert message={error.message} />;
  return null;
}
