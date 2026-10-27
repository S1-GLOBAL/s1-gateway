import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import { SelectField } from '@/shared/ui/SelectField';
import { TextField } from '@/shared/ui/TextField';
import { cn } from '@/shared/ui/cn';
import type { AtlasDictionary, SlotKey } from '../domain/atlas';
import { RULE_LABELS, SLOT_NAMES } from '../domain/atlas';
import { dictionaryOptions } from './dictionary-options';
import { SUGGESTIONS_SHOWN, searchDictionary, type DictionaryHit } from './dictionary-search';

/** Every value of every dictionary slot, then which slots apply to one product type. */
export function DictionaryBrowser({ dictionary }: { dictionary: AtlasDictionary }) {
  const productTypes = dictionary.slots.find((slot) => slot.key === 'productType')?.values ?? [];
  const [chosen, setChosen] = useState(productTypes[0]?.code ?? '');
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [picked, setPicked] = useState<DictionaryHit | null>(null);
  const listId = useId();
  const selected = productTypes.some((type) => type.code === chosen) ? chosen : (productTypes[0]?.code ?? '');
  const ruledSlots = SLOT_NAMES.filter((slot) => dictionary.rules.some((entry) => entry.slot === slot.key));
  const ruleFor = (productType: string, slot: SlotKey) =>
    dictionary.rules.find((entry) => entry.productType === productType && entry.slot === slot)?.rule;

  const asked = query.trim();
  const hits = searchDictionary(dictionary, asked);
  const suggestions = hits.slice(0, SUGGESTIONS_SHOWN);
  const active = Math.min(cursor, Math.max(suggestions.length - 1, 0));
  const matched = new Set(hits.map((hit) => `${hit.slotKey}:${hit.code}`));
  const slots = dictionary.slots
    .map((slot) => ({
      ...slot,
      values: asked === '' ? slot.values : slot.values.filter((value) => matched.has(`${slot.key}:${value.code}`)),
    }))
    .filter((slot) => slot.values.length > 0);

  useEffect(() => {
    if (!picked) return;
    document.getElementById(hitId(picked))?.scrollIntoView?.({ block: 'nearest' });
  }, [picked]);

  function pick(hit: DictionaryHit) {
    setPicked(hit);
    const index = suggestions.findIndex((item) => item.slotKey === hit.slotKey && item.code === hit.code);
    if (index >= 0) setCursor(index);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape' && asked !== '') {
      event.preventDefault();
      event.stopPropagation();
      setQuery('');
      setCursor(0);
      setPicked(null);
      return;
    }
    if (suggestions.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor((current) => (current + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor((current) => (current - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const hit = suggestions[active];
      if (hit) pick(hit);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1.5">
        <TextField
          label="Search"
          placeholder="Code or meaning"
          value={query}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={suggestions.length > 0}
          aria-controls={suggestions.length > 0 ? listId : undefined}
          aria-activedescendant={suggestions.length > 0 ? suggestionId(listId, active) : undefined}
          onChange={(event) => {
            setQuery(event.target.value);
            setCursor(0);
            setPicked(null);
          }}
          onKeyDown={onKeyDown}
        />
        {suggestions.length > 0 && (
          <div className="overflow-hidden rounded-control border border-border bg-surface shadow-md">
            <ul id={listId} role="listbox" aria-label="Matches" className="flex flex-col py-1">
              {suggestions.map((hit, index) => (
                <li key={`${hit.slotKey}-${hit.code}`}>
                  <div
                    id={suggestionId(listId, index)}
                    role="option"
                    aria-selected={index === active}
                    onMouseEnter={() => setCursor(index)}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      pick(hit);
                    }}
                    className={cn(
                      'flex cursor-pointer items-baseline gap-3 px-3 py-2 text-sm',
                      index === active ? 'bg-surface-sunken' : 'hover:bg-surface-raised',
                    )}
                  >
                    <span className="w-10 shrink-0 font-mono text-ink">{hit.code}</span>
                    <span className="min-w-0 flex-1 truncate text-ink">{hit.meaning}</span>
                    <span className="shrink-0 text-xs text-ink-subtle">{hit.slotName}</span>
                  </div>
                </li>
              ))}
            </ul>
            {hits.length > suggestions.length && (
              <p className="border-t border-border px-3 py-2 text-xs text-ink-subtle">
                {hits.length - suggestions.length} more in the lists below.
              </p>
            )}
          </div>
        )}
        {asked !== '' && hits.length === 0 && <p className="text-sm text-ink-muted">No codes or meanings match.</p>}
      </div>

      {slots.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {slots.map((slot) => (
            <article
              key={slot.key}
              aria-labelledby={`atlas-slot-${slot.key}`}
              className="rounded-surface border border-border bg-surface p-5"
            >
              <h3 id={`atlas-slot-${slot.key}`} className="text-md font-medium text-ink">
                {slot.name}
              </h3>
              <dl className="mt-3 flex flex-col gap-1.5 text-sm">
                {slot.values.map((value) => {
                  const hit = { slotKey: slot.key, slotName: slot.name, code: value.code, meaning: value.meaning };
                  const current = picked?.slotKey === slot.key && picked.code === value.code;
                  return (
                    <div
                      key={value.code}
                      id={hitId(hit)}
                      className={cn('flex gap-3 rounded-control px-2 py-0.5', current && 'bg-surface-sunken')}
                    >
                      <dt className="w-10 shrink-0 font-mono text-ink">{value.code}</dt>
                      <dd className="text-ink-muted">{value.meaning}</dd>
                    </div>
                  );
                })}
              </dl>
            </article>
          ))}
        </div>
      )}

      {asked === '' && (
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
      )}
    </div>
  );
}

function suggestionId(listId: string, index: number): string {
  return `${listId}-option-${index}`;
}

function hitId(hit: DictionaryHit): string {
  return `dictionary-hit-${hit.slotKey}-${hit.code}`;
}
