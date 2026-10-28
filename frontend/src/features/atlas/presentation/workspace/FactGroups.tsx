import type { ReactNode } from 'react';
import { Card } from '@/shared/ui/Card';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { SelectField, type SelectOption } from '@/shared/ui/SelectField';
import { TextField } from '@/shared/ui/TextField';
import { SLOT_NAMES, type AtlasDictionary, type SlotKey } from '../../domain/atlas';
import type { BuildForm } from '../../domain/build-facts';
import { joinNames, leftOutSlots } from '../../domain/left-out-slots';
import { lowerFirst } from '../../domain/lower-first';
import {
  CODE_SLOTS,
  isCountSlot,
  MEASURED_SLOTS,
  type CodeSlotKey,
  type MeasuredSlot,
} from '../../domain/slot-controls';
import { slotStateFor, type SlotState } from '../../domain/slot-state';
import { dictionaryOptions } from '../dictionary-options';

const NOT_KNOWN = 'Not known';
const NOT_KNOWN_OPTION: SelectOption = { value: '', label: NOT_KNOWN };

/** Groups 02 to 06, as #28 orders them. Group 01 is the product type. */
const GROUPS: readonly { number: string; title: string; slots: readonly SlotKey[] }[] = [
  { number: '02', title: "What it's made of", slots: ['material', 'coating', 'colourClarity'] },
  { number: '03', title: 'Shape', slots: ['shape', 'profile', 'wall', 'lidOpening'] },
  {
    number: '04',
    title: 'Size',
    slots: ['capacity', 'topDiameter', 'bottomDiameter', 'height', 'length', 'width', 'gusset', 'compartments'],
  },
  { number: '05', title: 'Weight and thickness', slots: ['unitWeight', 'basisWeight', 'thickness', 'plies'] },
  { number: '06', title: 'Print and features', slots: ['print', 'handle', 'wrap', 'window'] },
];

const nameOf = (key: SlotKey) => SLOT_NAMES.find((slot) => slot.key === key)?.name ?? key;

export interface FactGroupsProps {
  dictionary: AtlasDictionary;
  form: BuildForm;
  onChange(form: BuildForm): void;
  /** The server's reasons, by slot, for facts it refused. */
  fields: Readonly<Record<string, readonly string[]>>;
  className?: string;
}

/**
 * The facts, in six numbered groups; Material, whose names are long, spans its
 * group. A slot that does not apply to the product type, shape and material is
 * not shown, and one note names them; a slot waiting on the shape or material
 * shows "Not known" until it is chosen.
 */
export function FactGroups({ dictionary, form, onChange, fields, className }: FactGroupsProps) {
  const { shape, material } = form.codes;
  const stateOf = (key: SlotKey) => slotStateFor(dictionary.rules, form.productType, key, shape, material);
  const productTypes = dictionary.slots.find((slot) => slot.key === 'productType')?.values ?? [];
  const productTypeName = productTypes.find((value) => value.code === form.productType)?.meaning ?? form.productType;
  const leftOut = leftOutSlots(dictionary.rules, form.productType, shape, material);
  const setCode = (key: CodeSlotKey, value: string) => onChange({ ...form, codes: { ...form.codes, [key]: value } });

  function field(key: SlotKey): ReactNode {
    const state = stateOf(key);
    if (state === 'does-not-apply') return null;
    if (key === 'shape') {
      const options = [
        { value: '', label: NOT_KNOWN },
        ...(dictionary.slots.find((slot) => slot.key === 'shape')?.values ?? []).map(({ code, meaning }) => ({
          value: code,
          label: meaning,
        })),
      ];
      return (
        <Segmented key={key} label={nameOf(key)} errors={fields[key]} className="sm:col-span-2">
          <SegmentedControl
            label={nameOf(key)}
            value={form.codes.shape}
            options={options}
            onChange={(value) => setCode('shape', value)}
            className="flex-wrap"
          />
        </Segmented>
      );
    }
    if (key === 'capacity') {
      return (
        <CapacityField
          key={key}
          label={nameOf(key)}
          state={state}
          options={dictionaryOptions(dictionary, 'capacity', NOT_KNOWN_OPTION)}
          unit={form.capacityUnit}
          amount={form.capacityValue}
          onUnit={(capacityUnit) => onChange({ ...form, capacityUnit })}
          onAmount={(capacityValue) => onChange({ ...form, capacityValue })}
          errors={fields[key]}
        />
      );
    }
    if (isCountSlot(key)) {
      const open = state === 'any';
      return (
        <TextField
          key={key}
          label={nameOf(key)}
          value={open ? form.counts[key] : ''}
          onChange={(event) => onChange({ ...form, counts: { ...form.counts, [key]: event.target.value } })}
          disabled={!open}
          placeholder={NOT_KNOWN}
          errors={fields[key]}
          inputMode="numeric"
          autoComplete="off"
        />
      );
    }
    const measured = MEASURED_SLOTS.find((slot) => slot.key === key);
    if (measured) {
      return (
        <MeasuredField
          key={key}
          slot={measured}
          label={nameOf(key)}
          state={state}
          value={form.measures[measured.key].value}
          unit={form.measures[measured.key].unit}
          onChange={(measure) => onChange({ ...form, measures: { ...form.measures, [measured.key]: measure } })}
          errors={fields[key]}
        />
      );
    }
    const code = CODE_SLOTS.find((slot) => slot === key);
    if (!code) return null;
    return (
      <SelectField
        key={key}
        label={nameOf(key)}
        options={state === 'any' ? dictionaryOptions(dictionary, key, NOT_KNOWN_OPTION) : [NOT_KNOWN_OPTION]}
        value={state === 'any' ? form.codes[code] : ''}
        disabled={state !== 'any'}
        onChange={(event) => setCode(code, event.target.value)}
        errors={fields[key]}
        className={code === 'material' ? 'sm:col-span-2' : undefined}
      />
    );
  }

  return (
    <div className={className}>
      <div className="flex flex-col gap-4">
        <Group number="01" title="What it is">
          <SelectField
            label={nameOf('productType')}
            options={dictionaryOptions(dictionary, 'productType')}
            value={form.productType}
            onChange={(event) => onChange({ ...form, productType: event.target.value })}
            errors={fields.productType}
            className="sm:col-span-2"
          />
          {leftOut.length > 0 && (
            <p className="text-sm text-ink-muted sm:col-span-2">
              {`Not asked for a ${lowerFirst(productTypeName)}: ${joinNames(leftOut.map((key) => nameOf(key).toLowerCase()))}. They're left out of the code.`}
            </p>
          )}
        </Group>
        {GROUPS.map((group) => {
          const shown = group.slots.map(field).filter((node) => node !== null);
          if (shown.length === 0) return null;
          return (
            <Group key={group.number} number={group.number} title={group.title}>
              {shown}
            </Group>
          );
        })}
      </div>
    </div>
  );
}

function Group({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return (
    <Card aria-label={title} className="flex flex-col gap-4">
      <h2 className="flex items-baseline gap-3 text-md font-semibold text-ink">
        <span className="font-mono text-sm font-medium text-ink-subtle">{number}</span>
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

/** A segmented control with the label and error a field would have. */
function Segmented({
  label,
  errors = [],
  className,
  children,
}: {
  label: string;
  errors: readonly string[] | undefined;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium text-ink">{label}</p>
        {children}
        {errors.length > 0 && <p className="text-xs text-danger">{errors.join(' ')}</p>}
      </div>
    </div>
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

/** Nominal capacity: a unit, then an amount that waits for the unit, such as 12 or 3.25. */
function CapacityField({ label, state, options, unit, amount, onUnit, onAmount, errors }: CapacityFieldProps) {
  const open = state === 'any';
  return (
    <div className="flex gap-2 sm:col-span-2">
      <SelectField
        label={label}
        options={open ? options : [NOT_KNOWN_OPTION]}
        value={open ? unit : ''}
        disabled={!open}
        onChange={(event) => onUnit(event.target.value)}
        errors={errors}
        className="min-w-0 flex-1"
      />
      <TextField
        label={`${label} amount`}
        value={open ? amount : ''}
        onChange={(event) => onAmount(event.target.value)}
        disabled={!open || unit === ''}
        placeholder={NOT_KNOWN}
        inputMode="decimal"
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

/** A measured slot, with its unit beside it. Empty means not known. */
function MeasuredField({ slot, label, state, value, unit, onChange, errors }: MeasuredFieldProps) {
  const open = state === 'any';
  return (
    <div className="flex gap-2">
      <TextField
        label={label}
        value={open ? value : ''}
        onChange={(event) => onChange({ value: event.target.value, unit })}
        disabled={!open}
        placeholder={NOT_KNOWN}
        errors={errors}
        inputMode="decimal"
        autoComplete="off"
        className="min-w-0 flex-1"
      />
      <SelectField
        label={`${label} unit`}
        options={slot.units.map((option) => ({ value: option.value, label: option.label }))}
        value={unit}
        disabled={!open || slot.units.length === 1}
        onChange={(event) => onChange({ value, unit: event.target.value })}
        className="w-24 shrink-0"
      />
    </div>
  );
}
