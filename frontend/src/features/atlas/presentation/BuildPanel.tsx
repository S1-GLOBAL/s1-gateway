import { useState, type FormEvent } from 'react';
import { isSignInRequired } from '@/features/accounts';
import { Button } from '@/shared/ui/Button';
import { SelectField, type SelectOption } from '@/shared/ui/SelectField';
import { TextField } from '@/shared/ui/TextField';
import { SpecIdExistsError } from '../application/spec-id-exists-error';
import { useEncodeSpecId } from '../application/use-encode-spec-id';
import { useSaveSpecId } from '../application/use-save-spec-id';
import { SLOT_NAMES, type AtlasDictionary, type SlotKey } from '../domain/atlas';
import { initialBuildForm, toFacts, type BuildForm } from '../domain/build-facts';
import { formatSavedDate } from '../domain/format-saved-date';
import { CODE_SLOTS, MEASURED_SLOTS, type CodeSlotKey, type MeasuredSlot } from '../domain/slot-controls';
import { slotStateFor, type SlotState } from '../domain/slot-state';
import { dictionaryOptions } from './dictionary-options';
import { SavedSpecIdCard } from './SavedSpecIdCard';

const NOT_KNOWN: SelectOption = { value: '', label: 'Not known' };

/** What a locked slot offers: its one state, and nothing to change. */
const LOCKED: Record<Exclude<SlotState, 'any'>, SelectOption> = {
  'does-not-apply': { value: 'locked', label: "Doesn't apply" },
  'not-known': { value: 'locked', label: 'Not known' },
};

const nameOf = (key: SlotKey) => SLOT_NAMES.find((slot) => slot.key === key)?.name ?? key;

/**
 * Build a Spec ID from what is known about a product. A slot the product type,
 * shape or material rules out locks itself; the code is rebuilt by the server
 * as the form changes; Save names it and keeps it.
 */
export function BuildPanel({ dictionary, timeZone }: { dictionary: AtlasDictionary; timeZone?: string }) {
  const productTypes = dictionaryOptions(dictionary, 'productType');
  const [form, setForm] = useState<BuildForm>(() => initialBuildForm(productTypes[0]?.value ?? ''));
  const [name, setName] = useState('');
  const save = useSaveSpecId();
  const encoded = useEncodeSpecId(toFacts(form, dictionary.rules));

  const stateOf = (key: SlotKey) =>
    slotStateFor(dictionary.rules, form.productType, key, form.codes.shape, form.codes.material);
  // A change makes the last save's answer stale, so it goes.
  const change = (next: BuildForm) => {
    setForm(next);
    save.reset();
  };
  const setCode = (key: CodeSlotKey, value: string) => change({ ...form, codes: { ...form.codes, [key]: value } });

  const refused = encoded.error?.code === 'INVALID_SPEC_ID' ? encoded.error : undefined;
  const refusedSave = save.error?.code === 'INVALID_SPEC_ID' ? save.error : undefined;
  const fields = refused?.fields ?? refusedSave?.fields ?? {};

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.mutate({ name, facts: toFacts(form, dictionary.rules) });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SelectField
          label={nameOf('productType')}
          options={productTypes}
          value={form.productType}
          onChange={(event) => change({ ...form, productType: event.target.value })}
          errors={fields.productType}
        />
        {CODE_SLOTS.map((key) => (
          <CodeField
            key={key}
            label={nameOf(key)}
            state={stateOf(key)}
            options={dictionaryOptions(dictionary, key, NOT_KNOWN)}
            value={form.codes[key]}
            onChange={(value) => setCode(key, value)}
            errors={fields[key]}
          />
        ))}
        <CapacityField
          label={nameOf('capacity')}
          state={stateOf('capacity')}
          options={dictionaryOptions(dictionary, 'capacity', NOT_KNOWN)}
          unit={form.capacityUnit}
          amount={form.capacityValue}
          onUnit={(capacityUnit) => change({ ...form, capacityUnit })}
          onAmount={(capacityValue) => change({ ...form, capacityValue })}
          errors={fields.capacity}
        />
        {MEASURED_SLOTS.map((slot) => (
          <MeasuredField
            key={slot.key}
            slot={slot}
            label={nameOf(slot.key)}
            state={stateOf(slot.key)}
            value={form.measures[slot.key].value}
            unit={form.measures[slot.key].unit}
            onChange={(measure) => change({ ...form, measures: { ...form.measures, [slot.key]: measure } })}
            errors={fields[slot.key]}
          />
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium text-ink">Spec ID</p>
        <p aria-live="polite" className="min-h-6 font-mono text-sm break-all text-ink">
          {refused ? '' : encoded.data?.code}
        </p>
        {encoded.error && !refused && <Alert message={encoded.error.message} />}
      </div>

      <form onSubmit={submit} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start">
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
          className="min-w-0 flex-1"
        />
        <Button type="submit" loading={save.isPending} className="sm:mt-6.5">
          Save
        </Button>
      </form>

      <SaveOutcome save={save} timeZone={timeZone} />
    </div>
  );
}

function SaveOutcome({ save, timeZone }: { save: ReturnType<typeof useSaveSpecId>; timeZone?: string }) {
  const { data, error } = save;
  if (data) {
    return (
      <p role="status" className="text-sm text-ink">
        {`Saved ${data.code} as "${data.name}".`}
      </p>
    );
  }
  if (error instanceof SpecIdExistsError) {
    const { existing } = error;
    const who = existing.savedBy.fullName;
    const date = formatSavedDate(existing.savedAt, timeZone);
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="text-sm text-ink">
          {`This Spec ID already exists, saved as "${existing.name}" by ${who} on ${date}. Nothing new was saved.`}
        </p>
        <SavedSpecIdCard saved={existing} timeZone={timeZone} />
      </div>
    );
  }
  if (isSignInRequired(error)) return <Alert message="Sign in to save Spec IDs." />;
  // Slot and name problems are already beside their controls.
  if (error && error.code !== 'INVALID_SPEC_ID') return <Alert message={error.message} />;
  return null;
}

function Alert({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
      {message}
    </p>
  );
}

interface CodeFieldProps {
  label: string;
  state: SlotState;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  errors: readonly string[] | undefined;
}

/** A dictionary slot: a choice of codes, or its one locked state. */
function CodeField({ label, state, options, value, onChange, errors }: CodeFieldProps) {
  if (state !== 'any') {
    return <SelectField label={label} options={[LOCKED[state]]} value="locked" disabled onChange={() => undefined} />;
  }
  return (
    <SelectField
      label={label}
      options={options}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      errors={errors}
    />
  );
}

interface CapacityFieldProps {
  label: string;
  state: SlotState;
  options: SelectOption[];
  unit: string;
  amount: string;
  onUnit: (unit: string) => void;
  onAmount: (amount: string) => void;
  errors: readonly string[] | undefined;
}

/** Nominal capacity: a unit, then a whole number that waits for the unit. */
function CapacityField({ label, state, options, unit, amount, onUnit, onAmount, errors }: CapacityFieldProps) {
  if (state !== 'any') {
    return <SelectField label={label} options={[LOCKED[state]]} value="locked" disabled onChange={() => undefined} />;
  }
  return (
    <div className="flex gap-2">
      <SelectField
        label={label}
        options={options}
        value={unit}
        onChange={(event) => onUnit(event.target.value)}
        errors={errors}
        className="min-w-0 flex-1"
      />
      <TextField
        label={`${label} amount`}
        value={amount}
        onChange={(event) => onAmount(event.target.value)}
        disabled={unit === ''}
        inputMode="numeric"
        autoComplete="off"
        className="w-28 shrink-0"
      />
    </div>
  );
}

interface MeasuredFieldProps {
  slot: MeasuredSlot;
  label: string;
  state: SlotState;
  value: string;
  unit: string;
  onChange: (measure: { value: string; unit: string }) => void;
  errors: readonly string[] | undefined;
}

/** A measured slot: what was measured, and in which unit. Empty means not known. */
function MeasuredField({ slot, label, state, value, unit, onChange, errors }: MeasuredFieldProps) {
  if (state !== 'any') {
    return <SelectField label={label} options={[LOCKED[state]]} value="locked" disabled onChange={() => undefined} />;
  }
  return (
    <div className="flex gap-2">
      <TextField
        label={label}
        value={value}
        onChange={(event) => onChange({ value: event.target.value, unit })}
        errors={errors}
        inputMode="decimal"
        autoComplete="off"
        className="min-w-0 flex-1"
      />
      <SelectField
        label={`${label} unit`}
        options={slot.units.map(({ value: unitValue, label: unitLabel }) => ({ value: unitValue, label: unitLabel }))}
        value={unit}
        onChange={(event) => onChange({ value, unit: event.target.value })}
        className="w-32 shrink-0"
      />
    </div>
  );
}
