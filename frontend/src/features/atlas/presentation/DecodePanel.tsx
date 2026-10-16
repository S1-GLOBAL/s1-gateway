import { useState, type FormEvent } from 'react';
import { Button } from '@/shared/ui/Button';
import { ErrorState } from '@/shared/ui/ErrorState';
import { TextField } from '@/shared/ui/TextField';
import { useDecodeSpecId } from '../application/use-decode-spec-id';
import { SLOT_NAMES } from '../domain/atlas';
import { DecodedSlotsTable, type DecodedSlotRow } from './DecodedSlotsTable';

/**
 * Paste a Spec ID and read it slot by slot. A refused code is still laid out
 * part by part when it has 18 parts, with each message beside its slot.
 */
export function DecodePanel() {
  const [code, setCode] = useState('');
  const decode = useDecodeSpecId();
  const { error } = decode;
  const invalid = error?.code === 'INVALID_SPEC_ID';

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Always the server's call, even for an empty box: it owns every message.
    decode.mutate(code);
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={submit} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <TextField
          id="atlas-decode-code"
          label="Spec ID"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          errors={invalid ? error.fields.code : undefined}
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1"
        />
        <Button type="submit" loading={decode.isPending} className="sm:mt-6.5">
          Decode
        </Button>
      </form>

      {decode.data && <DecodedSlotsTable rows={decode.data.slots} />}
      {invalid && <RefusedCode code={decode.variables ?? ''} fields={error.fields} />}
      {error && !invalid && (
        <ErrorState message={error.message} onRetry={() => decode.mutate(decode.variables ?? code)} />
      )}
    </div>
  );
}

/** The refused code's parts, each with the server's messages about it. Nothing when it is not 18 parts. */
function RefusedCode({ code, fields }: { code: string; fields: Record<string, string[]> }) {
  const parts = code.trim().split('.');
  if (parts.length !== SLOT_NAMES.length) return null;

  const rows: DecodedSlotRow[] = SLOT_NAMES.map((slot, index) => ({
    number: index + 1,
    key: slot.key,
    name: slot.name,
    raw: parts[index] ?? '',
    meaning: '',
    messages: fields[slot.key],
  }));
  return <DecodedSlotsTable rows={rows} />;
}
