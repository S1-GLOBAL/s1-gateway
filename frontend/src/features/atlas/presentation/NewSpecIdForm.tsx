import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { TextField } from '@/shared/ui/TextField';
import { useSaveSpecId } from '../application/use-save-spec-id';
import { useSpecIdDraft } from '../application/use-spec-id-draft';
import type { AtlasDictionary, DecodedSpecId } from '../domain/atlas';
import { initialBuildForm, type BuildForm } from '../domain/build-facts';
import { toBuildForm } from '../domain/to-build-form';
import { SaveOutcome } from './SaveOutcome';
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
