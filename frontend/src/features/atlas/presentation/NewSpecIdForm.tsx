import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isSignInRequired } from '@/features/accounts';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { TextField } from '@/shared/ui/TextField';
import { SpecIdExistsError } from '../application/spec-id-exists-error';
import { useSaveSpecId } from '../application/use-save-spec-id';
import { useSpecIdDraft } from '../application/use-spec-id-draft';
import type { AtlasDictionary, DecodedSpecId } from '../domain/atlas';
import { initialBuildForm, type BuildForm } from '../domain/build-facts';
import { formatSavedDate } from '../domain/format-saved-date';
import { toBuildForm } from '../domain/to-build-form';
import { Alert } from './workspace/Alert';
import { SpecIdWorkspace } from './workspace/SpecIdWorkspace';

/** What a Spec ID's page shows once, after it is saved. */
export interface SavedNotice {
  notice: string;
}

export interface NewSpecIdFormProps {
  dictionary: AtlasDictionary;
  /** A code to start from (`/atlas/new?code=`), or null to start empty. */
  seed: DecodedSpecId | null;
  timeZone?: string;
}

/**
 * A new Spec ID: the workspace, then a name and Save Spec ID, which waits
 * while another saved Spec ID has the code. A save opens the saved Spec ID.
 */
export function NewSpecIdForm({ dictionary, seed, timeZone }: NewSpecIdFormProps) {
  const navigate = useNavigate();
  const draft = useSpecIdDraft(dictionary.rules, () =>
    seed ? toBuildForm(seed) : initialBuildForm(dictionary.slots.find((slot) => slot.key === 'productType')?.values[0]?.code ?? ''),
  );
  const [name, setName] = useState('');
  const save = useSaveSpecId();
  const refusedSave = save.error?.code === 'INVALID_SPEC_ID' ? save.error : undefined;

  // A change makes the last save's answer stale, so it goes.
  const change = (form: BuildForm) => {
    draft.setForm(form);
    save.reset();
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const saved = await save.mutateAsync({ name, facts: draft.facts });
      const state: SavedNotice = { notice: `Saved ${saved.code} as "${saved.name}".` };
      navigate(`/atlas/${saved.id}`, { state });
    } catch {
      // The answer is shown from `save.error`.
    }
  }

  return (
    <SpecIdWorkspace
      dictionary={dictionary}
      form={draft.form}
      onChange={change}
      decoded={draft.decoded}
      codeError={draft.codeError}
      fields={draft.fields ?? refusedSave?.fields ?? {}}
      match={draft.match}
      side={
        <Card className="flex flex-col gap-4">
          <form onSubmit={submit} noValidate className="flex flex-col gap-3">
            <TextField
              label="Name"
              hint="Up to 120 characters."
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                save.reset();
              }}
              errors={refusedSave?.fields.name}
              autoComplete="off"
            />
            <Button type="submit" loading={save.isPending} disabled={draft.match !== null || !draft.decoded}>
              Save Spec ID
            </Button>
          </form>
          {draft.match && (
            <p role="status" className="text-sm text-ink-muted">
              This code is already saved. Open it to add or correct facts instead.
            </p>
          )}
          <SaveOutcome error={save.error} timeZone={timeZone} />
        </Card>
      }
      timeZone={timeZone}
    />
  );
}

function SaveOutcome({ error, timeZone }: { error: ReturnType<typeof useSaveSpecId>['error']; timeZone?: string }) {
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
  // Slot and name problems are already beside their controls.
  if (error && error.code !== 'INVALID_SPEC_ID') return <Alert message={error.message} />;
  return null;
}
