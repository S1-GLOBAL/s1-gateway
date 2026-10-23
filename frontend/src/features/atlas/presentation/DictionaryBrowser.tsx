import { useState } from 'react';
import { SelectField } from '@/shared/ui/SelectField';
import type { AtlasDictionary, SlotKey, SlotRule } from '../domain/atlas';
import { SLOT_NAMES } from '../domain/atlas';
import { dictionaryOptions } from './dictionary-options';

/** The specification's own words for each rule. */
const RULE_LABELS: Record<SlotRule, string> = {
  applies: 'Applies',
  never: 'X',
  round_only: 'Round only',
  non_round_only: 'Non-round only',
  paper_only: 'Paper family only',
};

/** Every value of every dictionary slot, then which slots apply to one product type. */
export function DictionaryBrowser({ dictionary }: { dictionary: AtlasDictionary }) {
  const productTypes = dictionary.slots.find((slot) => slot.key === 'productType')?.values ?? [];
  const [chosen, setChosen] = useState(productTypes[0]?.code ?? '');
  const selected = productTypes.some((type) => type.code === chosen) ? chosen : (productTypes[0]?.code ?? '');
  const ruledSlots = SLOT_NAMES.filter((slot) => dictionary.rules.some((entry) => entry.slot === slot.key));
  const ruleFor = (productType: string, slot: SlotKey) =>
    dictionary.rules.find((entry) => entry.productType === productType && entry.slot === slot)?.rule;

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-4 sm:grid-cols-2">
        {dictionary.slots.map((slot) => (
          <article
            key={slot.key}
            aria-labelledby={`atlas-slot-${slot.key}`}
            className="rounded-surface border border-border bg-surface p-5"
          >
            <h3 id={`atlas-slot-${slot.key}`} className="text-md font-medium text-ink">
              {slot.name}
            </h3>
            <dl className="mt-3 flex flex-col gap-1.5 text-sm">
              {slot.values.map((value) => (
                <div key={value.code} className="flex gap-3">
                  <dt className="w-10 shrink-0 font-mono text-ink">{value.code}</dt>
                  <dd className="text-ink-muted">{value.meaning}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <h3 id="atlas-which-slots" className="text-md font-medium text-ink">
          Which slots apply
        </h3>
        {selected !== '' && (
          <SelectField
            label="Product type"
            options={dictionaryOptions(dictionary, 'productType')}
            value={selected}
            onChange={(event) => setChosen(event.target.value)}
          />
        )}
        <div className="overflow-x-auto rounded-surface border border-border bg-surface">
          <table aria-labelledby="atlas-which-slots" className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-ink-muted">
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Slot
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Rule
                </th>
              </tr>
            </thead>
            <tbody>
              {ruledSlots.map((slot) => {
                const rule = ruleFor(selected, slot.key);
                return (
                  <tr key={slot.key} className="border-b border-border last:border-b-0">
                    <th scope="row" className="px-4 py-2.5 font-medium whitespace-nowrap text-ink">
                      {slot.name}
                    </th>
                    <td className="px-4 py-2.5 whitespace-nowrap text-ink-muted">{rule ? RULE_LABELS[rule] : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
