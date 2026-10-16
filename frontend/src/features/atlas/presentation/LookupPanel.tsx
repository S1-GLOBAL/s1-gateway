import { useState, type FormEvent } from 'react';
import { Button } from '@/shared/ui/Button';
import { ErrorState } from '@/shared/ui/ErrorState';
import { SelectField, type SelectOption } from '@/shared/ui/SelectField';
import { TextField } from '@/shared/ui/TextField';
import { useFindSpecId } from '../application/use-find-spec-id';
import { useSimilarSpecIds } from '../application/use-similar-spec-ids';
import { SLOT_NAMES, type AtlasDictionary, type SimilarCriteria, type SlotKey } from '../domain/atlas';
import { initialLookupForm, toCriteria, type LookupForm } from '../domain/lookup-criteria';
import { CODE_SLOTS, MEASURED_SLOTS, type CodeSlotKey, type MeasuredSlotKey } from '../domain/slot-controls';
import { dictionaryOptions } from './dictionary-options';
import { SavedSpecIdCard } from './SavedSpecIdCard';
import { SavedSpecIdList } from './SavedSpecIdList';

const ANY: SelectOption = { value: '', label: 'Any' };

const nameOf = (key: SlotKey) => SLOT_NAMES.find((slot) => slot.key === key)?.name ?? key;

/** Find saved Spec IDs: one by its exact code, or those that fit the slots chosen. */
export function LookupPanel({ dictionary, timeZone }: { dictionary: AtlasDictionary; timeZone?: string }) {
  return (
    <div className="flex flex-col gap-8">
      <ExactLookup timeZone={timeZone} />
      <SimilarLookup dictionary={dictionary} timeZone={timeZone} />
    </div>
  );
}

function ExactLookup({ timeZone }: { timeZone?: string }) {
  const [code, setCode] = useState('');
  const find = useFindSpecId();
  const { error } = find;
  const missing = error?.code === 'SPEC_ID_NOT_FOUND';
  const empty = code.trim() === '';

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // An empty code has no address of its own: it would ask for the whole list.
    if (!empty) find.mutate(code.trim());
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={submit} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <TextField
          label="Exact code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1"
        />
        <Button type="submit" variant="secondary" loading={find.isPending} disabled={empty} className="sm:mt-6.5">
          Find
        </Button>
      </form>

      {find.data && <SavedSpecIdCard saved={find.data} timeZone={timeZone} />}
      {missing && (
        <p role="status" className="text-sm text-ink-muted">
          {error.message}
        </p>
      )}
      {error && !missing && <ErrorState message={error.message} onRetry={() => find.mutate(find.variables ?? code.trim())} />}
    </div>
  );
}

function SimilarLookup({ dictionary, timeZone }: { dictionary: AtlasDictionary; timeZone?: string }) {
  const [form, setForm] = useState<LookupForm>(initialLookupForm);
  const [criteria, setCriteria] = useState<SimilarCriteria>({});
  const similar = useSimilarSpecIds(criteria);
  const { data, error } = similar;
  const fields = error?.code === 'VALIDATION_FAILED' ? error.fields : {};

  const setCode = (key: CodeSlotKey, value: string) => setForm({ ...form, codes: { ...form.codes, [key]: value } });
  const setMeasure = (key: MeasuredSlotKey, value: string) =>
    setForm({ ...form, measures: { ...form.measures, [key]: value } });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCriteria(toCriteria(form));
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-md font-medium text-ink">Similar</h3>
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <SelectField
            label={nameOf('productType')}
            options={dictionaryOptions(dictionary, 'productType', ANY)}
            value={form.productType}
            onChange={(event) => setForm({ ...form, productType: event.target.value })}
            errors={fields.productType}
          />
          {CODE_SLOTS.map((key) => (
            <SelectField
              key={key}
              label={nameOf(key)}
              options={dictionaryOptions(dictionary, key, ANY)}
              value={form.codes[key]}
              onChange={(event) => setCode(key, event.target.value)}
              errors={fields[key]}
            />
          ))}
          <div className="flex gap-2">
            <SelectField
              label={nameOf('capacity')}
              options={dictionaryOptions(dictionary, 'capacity', ANY)}
              value={form.capacityUnit}
              onChange={(event) => setForm({ ...form, capacityUnit: event.target.value })}
              errors={fields.capacity}
              className="min-w-0 flex-1"
            />
            <TextField
              label={`${nameOf('capacity')} amount`}
              value={form.capacityValue}
              onChange={(event) => setForm({ ...form, capacityValue: event.target.value })}
              disabled={form.capacityUnit === ''}
              inputMode="numeric"
              autoComplete="off"
              className="w-28 shrink-0"
            />
          </div>
          {MEASURED_SLOTS.map((slot) => (
            <TextField
              key={slot.key}
              label={`${nameOf(slot.key)} (${slot.units[0]?.label ?? ''})`}
              value={form.measures[slot.key]}
              onChange={(event) => setMeasure(slot.key, event.target.value)}
              errors={fields[slot.key]}
              inputMode="decimal"
              autoComplete="off"
            />
          ))}
        </div>
        <div>
          <Button type="submit" variant="secondary" loading={similar.isFetching}>
            Find similar
          </Button>
        </div>
      </form>

      {data && (
        <div className="flex flex-col gap-5">
          {data.fits.length === 0 && data.mightFit.length === 0 ? (
            <p role="status" className="text-sm text-ink-muted">
              {Object.keys(criteria).length === 0
                ? 'No Spec IDs saved yet. Build one above and save it.'
                : 'No saved Spec IDs fit these choices. Set a slot back to Any to widen the search.'}
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-medium text-ink">{`Fits (${data.fits.length})`}</h4>
                <SavedSpecIdList items={data.fits} timeZone={timeZone} />
              </div>
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-medium text-ink">{`Might fit (${data.mightFit.length})`}</h4>
                <SavedSpecIdList items={data.mightFit} timeZone={timeZone} />
              </div>
            </>
          )}
        </div>
      )}
      {error && error.code !== 'VALIDATION_FAILED' && (
        <ErrorState message={error.message} onRetry={() => void similar.refetch()} />
      )}
    </div>
  );
}
