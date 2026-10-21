import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { TextField } from '@/shared/ui/TextField';
import { useSaveSpecId } from '../../application/use-save-spec-id';
import type { DecodedSpecId, SlotRuleEntry } from '../../domain/atlas';
import { toFacts } from '../../domain/build-facts';
import { toBuildForm } from '../../domain/to-build-form';
import type { SavedNotice } from '../NewSpecIdForm';
import { SaveOutcome } from '../SaveOutcome';
import { Alert } from '../workspace/Alert';

export interface SaveFromSearchProps {
  /** The code Search read, which nothing saved fits. */
  decoded: DecodedSpecId;
  /** The text Search read, trimmed: where the name starts. */
  text: string;
  rules: readonly SlotRuleEntry[];
  timeZone?: string;
}

/**
 * Saves the code Search read as a new Spec ID, named from the search text, the
 * same save New Spec ID makes. A save opens the saved Spec ID.
 */
export function SaveFromSearch({ decoded, text, rules, timeZone }: SaveFromSearchProps) {
  const navigate = useNavigate();
  const [name, setName] = useState(text);
  const save = useSaveSpecId();
  const refused = save.error?.code === 'INVALID_SPEC_ID' ? save.error : undefined;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const saved = await save.mutateAsync({ name, facts: toFacts(toBuildForm(decoded), rules) });
      const state: SavedNotice = { notice: `Saved ${saved.code} as "${saved.name}".` };
      navigate(`/atlas/${saved.id}`, { state });
    } catch {
      // The answer is shown from `save.error`.
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-3 rounded-surface border border-border bg-surface p-5 shadow-sm"
    >
      <TextField
        label="Name"
        hint="Up to 120 characters."
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          save.reset();
        }}
        errors={refused?.fields.name}
        autoComplete="off"
      />
      <Button type="submit" loading={save.isPending} className="self-start">
        Save as a new Spec ID
      </Button>
      {/* There are no slot controls here, so a refusal about anything but the name is said in full. */}
      {refused && !refused.fields.name && <Alert message={refused.message} />}
      <SaveOutcome error={save.error} timeZone={timeZone} />
    </form>
  );
}
