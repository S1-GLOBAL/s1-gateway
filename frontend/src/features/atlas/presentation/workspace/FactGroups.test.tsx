import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { s2Dictionary } from '../../application/testing/atlas-fixtures';
import { SLOT_NAMES, type SlotKey } from '../../domain/atlas';
import { initialBuildForm } from '../../domain/build-facts';
import { FactGroups } from './FactGroups';

const productTypes = s2Dictionary.slots.find((slot) => slot.key === 'productType')?.values ?? [];
const nameOf = (key: SlotKey) => SLOT_NAMES.find((slot) => slot.key === key)?.name ?? key;

function renderGroups(productType: string) {
  render(
    <FactGroups dictionary={s2Dictionary} form={initialBuildForm(productType)} onChange={() => undefined} fields={{}} />,
  );
}

/** Whether a slot's control is on screen: shape is a row of choices, every other slot a labelled control. */
function isShown(key: SlotKey): boolean {
  if (key === 'shape') return screen.queryByRole('radiogroup', { name: 'Shape' }) !== null;
  return screen.queryByLabelText(nameOf(key)) !== null;
}

const optionLabels = (label: string) =>
  [...(screen.getByLabelText(label) as HTMLSelectElement).options].map((option) => option.textContent);

describe('FactGroups, the slots S2 0.1.0 applies', () => {
  it('has a rule for each of the 22 ruled slots of all 31 product types', () => {
    expect(productTypes).toHaveLength(31);
    expect(s2Dictionary.rules).toHaveLength(31 * 22);
  });

  it.each(productTypes.map(({ code, meaning }) => [meaning, code]))(
    'for a %s (%s), shows exactly the slots that can apply',
    (_meaning, code) => {
      renderGroups(code);
      const rules = s2Dictionary.rules.filter((entry) => entry.productType === code);
      expect(rules).toHaveLength(22);
      for (const { slot, rule } of rules) expect([slot, isShown(slot)]).toEqual([slot, rule !== 'never']);
    },
  );

  it('names the new slots a cup never has', () => {
    renderGroups('CUP');
    expect(
      screen.getByText(
        "Not asked for a cup: profile, gusset, compartments, plies, lid opening, handle, individual wrap and window. They're left out of the code.",
      ),
    ).toBeTruthy();
  });

  it('hides the shape group of a stand-up pouch, which has no shape, profile, wall or lid opening', () => {
    renderGroups('SUP');
    expect(screen.queryByRole('radiogroup', { name: 'Shape' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Shape' })).toBeNull();
  });

  it('keeps the capitals of a code in a product type name', () => {
    renderGroups('RSC');
    expect(screen.getByText(/^Not asked for a shipping box \(RSC\): shape, profile,/)).toBeTruthy();
  });
});

describe('FactGroups, the controls', () => {
  it('lists all 31 product types in code order, each as a code writes it', () => {
    renderGroups('BAG');
    const labels = optionLabels('Product type');
    expect(labels).toHaveLength(31);
    expect(labels.slice(0, 3)).toEqual(['A1 — Bowl lid', 'A2 — Cup lid', 'A3 — Bowl']);
    expect((screen.getByLabelText('Product type') as HTMLSelectElement).value).toBe('BAG');
  });

  it('gives Material the full width of its group, for its long names', () => {
    renderGroups('CUP');
    expect(screen.getByLabelText('Material').parentElement?.className).toContain('sm:col-span-2');
    expect(screen.getByLabelText('Coating').parentElement?.className).not.toContain('sm:col-span-2');
  });

  it('offers each new choice with "Not known" first', () => {
    renderGroups('CUP');
    expect(optionLabels('Wall')).toEqual(['Not known', 'Q1 — Single wall', 'Q2 — Double wall', 'Q3 — Ripple wall']);
    expect(optionLabels('Print')[0]).toBe('Not known');
    expect(optionLabels('Print')).toHaveLength(11);
  });

  it('asks for compartments and plies as numbers, "Not known" while empty', () => {
    renderGroups('NPK');
    const plies = screen.getByLabelText('Plies') as HTMLInputElement;
    expect(plies.placeholder).toBe('Not known');
    expect(plies.inputMode).toBe('numeric');
    expect(plies.value).toBe('');
    expect(within(screen.getByRole('region', { name: 'Weight and thickness' })).getByLabelText('Plies')).toBe(plies);
  });

  it('asks for a capacity amount that may have decimals, such as 3.25', () => {
    renderGroups('CUP');
    expect((screen.getByLabelText('Nominal capacity amount') as HTMLInputElement).inputMode).toBe('decimal');
  });

  it('puts print, handle and window under 06 Print and features', () => {
    renderGroups('BAG');
    const features = screen.getByRole('region', { name: 'Print and features' });
    expect(within(features).getByRole('heading').textContent).toBe('06Print and features');
    for (const label of ['Print', 'Handle', 'Window']) expect(within(features).getByLabelText(label)).toBeTruthy();
  });

  it('puts compartments under Size', () => {
    renderGroups('BWL');
    expect(within(screen.getByRole('region', { name: 'Size' })).getByLabelText('Compartments')).toBeTruthy();
  });
});
