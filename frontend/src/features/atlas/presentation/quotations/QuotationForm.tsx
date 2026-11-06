import { useState, type FormEvent } from 'react';
import { Button } from '@/shared/ui/Button';
import { SelectField } from '@/shared/ui/SelectField';
import { Sheet } from '@/shared/ui/Sheet';
import { TextField } from '@/shared/ui/TextField';
import { useManufacturerOptions, useSendQuotation } from '../../application/use-quotations';
import { fieldsOf, QUOTATION_FIELDS, type Quotation, type QuotationFields } from '../../domain/quotation';

/** The choice of a manufacturer not yet in Atlas. */
const NEW = 'new';

export interface QuotationFormProps {
  specId: string;
  /** Whether the sheet is open. */
  open: boolean;
  /** The quotation to edit, as it asks now; null to add one. */
  editing: Quotation | null;
  onClose(): void;
  /** Says what happened, once it is sent. */
  onSent(message: string): void;
}

/**
 * Adding a quotation to a Spec ID, or editing one that waits (plan 0017): a
 * manufacturer, chosen from those in Atlas or named new, and the quote's
 * values as quoted. FOB per unit is required. Nothing changes on the Spec ID
 * until an admin approves it. The server checks it, and its messages show
 * under the field each is about.
 */
export function QuotationForm({ specId, open, editing, onClose, onSent }: QuotationFormProps) {
  const start = editing === null ? null : fieldsOf(editing);
  const [choice, setChoice] = useState(start === null ? '' : 'id' in start.manufacturer ? start.manufacturer.id : NEW);
  const [name, setName] = useState(start !== null && 'name' in start.manufacturer ? start.manufacturer.name : '');
  const [country, setCountry] = useState(start !== null && 'country' in start.manufacturer ? start.manufacturer.country : '');
  const [values, setValues] = useState<QuotationFields['values']>(start?.values ?? {});
  const manufacturers = useManufacturerOptions(open);
  const send = useSendQuotation();
  const fields = send.error?.fields ?? {};

  async function submit(event: FormEvent) {
    event.preventDefault();
    const manufacturer = choice === NEW ? { name, country } : { id: choice };
    try {
      await send.mutateAsync({ specId, fields: { manufacturer, values }, editing });
      onSent(editing === null ? 'Added. It waits for an admin to approve it.' : 'Saved. It still waits for an admin.');
    } catch {
      // The answer is shown from `send.error`.
    }
  }

  const options = [
    { value: '', label: manufacturers.isPending ? 'Loading manufacturers…' : 'Choose a manufacturer' },
    ...(manufacturers.data ?? []).map((manufacturer) => ({
      value: manufacturer.id,
      label: manufacturer.country === null ? manufacturer.name : `${manufacturer.name} (${manufacturer.country})`,
    })),
    { value: NEW, label: 'A manufacturer not in Atlas yet' },
  ];
  // Only this form's own fields: a problem with anything else is said as a whole.
  const known = new Set(['manufacturer', 'manufacturerName', 'manufacturerCountry', ...QUOTATION_FIELDS.map(({ key }) => key)]);
  const unplaced = send.error !== null && Object.keys(fields).every((field) => !known.has(field));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing === null ? 'Add quotation' : 'Edit quotation'}
      description="It waits for an admin to approve it before it joins this Spec ID's quotes."
    >
      <form noValidate onSubmit={submit} className="flex flex-col gap-5">
        <SelectField
          label="Manufacturer"
          name="manufacturer"
          value={choice}
          onChange={(event) => setChoice(event.target.value)}
          options={options}
          errors={fields.manufacturer}
          hint={manufacturers.isError ? 'The list could not be loaded. You can still name a new manufacturer.' : undefined}
        />
        {choice === NEW && (
          <div className="flex flex-col gap-5 rounded-control bg-surface-sunken p-3">
            <TextField
              label="Company name"
              name="manufacturerName"
              value={name}
              onChange={(event) => setName(event.target.value)}
              errors={fields.manufacturerName}
              hint="Added to Atlas once the quotation is approved."
            />
            <TextField
              label="Country"
              name="manufacturerCountry"
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              errors={fields.manufacturerCountry}
            />
          </div>
        )}
        {QUOTATION_FIELDS.map(({ key, label, required, hint }) => (
          <TextField
            key={key}
            label={required ? label : `${label} (optional)`}
            name={key}
            value={values[key] ?? ''}
            onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
            errors={fields[key]}
            hint={hint}
          />
        ))}
        {unplaced && (
          <p role="alert" className="text-sm text-danger">
            {send.error?.message}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={send.isPending}>
            {editing === null ? 'Add quotation' : 'Save'}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
