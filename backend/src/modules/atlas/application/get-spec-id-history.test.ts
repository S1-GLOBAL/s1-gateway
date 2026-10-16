import { describe, expect, it } from 'vitest';
import { FixedClock, SequentialIdGenerator } from '../../../shared/application/testing/fakes.js';
import { SpecIdNotFoundError } from '../domain/spec-id.errors.js';
import { GetSpecIdHistory } from './get-spec-id-history.js';
import { SaveSpecId } from './save-spec-id.js';
import { InMemoryDictionaryRepository } from './testing/in-memory-dictionary-repository.js';
import { InMemorySpecIdRepository } from './testing/in-memory-spec-id-repository.js';
import { UpdateSpecId } from './update-spec-id.js';

const BOWL = { productType: 'BWL', material: 'BKR', shape: 'RD', unitWeight: { value: '12', unit: 'g' } };
const SAVER = { id: '00000000-0000-4000-8000-0000000000aa', fullName: 'Ada Invented' };
const EDITOR = { id: '00000000-0000-4000-8000-0000000000bb', fullName: 'Ben Invented' };

async function setup() {
  const dictionaries = new InMemoryDictionaryRepository();
  const specIds = new InMemorySpecIdRepository();
  specIds.nameSaver(SAVER.id, SAVER.fullName);
  specIds.nameSaver(EDITOR.id, EDITOR.fullName);
  const ids = new SequentialIdGenerator();
  const saved = await new SaveSpecId(
    dictionaries,
    specIds,
    new FixedClock(new Date('2026-10-15T08:00:00.000Z')),
    ids,
  ).execute({ name: 'Kraft soup bowl', facts: BOWL, savedBy: SAVER });
  if (!saved.ok) throw saved.error;
  const update = (at: string) => new UpdateSpecId(dictionaries, specIds, new FixedClock(new Date(at)), ids);
  return { history: new GetSpecIdHistory(dictionaries, specIds), update, id: saved.value.id };
}

describe('GetSpecIdHistory', () => {
  it('lists every change newest first, the creation last', async () => {
    const { history, update, id } = await setup();
    await update('2026-10-16T09:05:00.000Z').execute({ id, name: 'Soup bowl, kraft', facts: BOWL, version: 1, updatedBy: EDITOR });

    const result = await history.execute({ id });

    if (!result.ok) throw result.error;
    expect(result.value.map((entry) => [entry.kind, entry.changedBy.fullName, entry.changedAt])).toEqual([
      ['updated', 'Ben Invented', '2026-10-16T09:05:00.000Z'],
      ['created', 'Ada Invented', '2026-10-15T08:00:00.000Z'],
    ]);
  });

  it('reads each changed slot in plain words, and marks a replaced known value as corrected', async () => {
    const { history, update, id } = await setup();
    await update('2026-10-17T14:32:00.000Z').execute({
      id,
      name: 'Kraft soup bowl',
      facts: { ...BOWL, height: { value: '62', unit: 'mm' }, unitWeight: { value: '11.8', unit: 'g' } },
      version: 1,
      updatedBy: EDITOR,
    });

    const result = await history.execute({ id });

    if (!result.ok) throw result.error;
    expect(result.value[0]?.slots).toEqual([
      { key: 'height', name: 'Height', before: 'Not known', after: '62 mm', corrected: false },
      { key: 'unitWeight', name: 'Unit weight', before: '12 g', after: '11.8 g', corrected: true },
    ]);
  });

  it('gives a change of name alone, and the creation, no slot rows', async () => {
    const { history, update, id } = await setup();
    await update('2026-10-16T09:05:00.000Z').execute({ id, name: 'Soup bowl, kraft', facts: BOWL, version: 1, updatedBy: EDITOR });

    const result = await history.execute({ id });

    if (!result.ok) throw result.error;
    expect(result.value.map((entry) => entry.slots)).toEqual([[], []]);
    expect(result.value[0]?.nameBefore).toBe('Kraft soup bowl');
    expect(result.value[0]?.nameAfter).toBe('Soup bowl, kraft');
  });

  it('answers not found for an id nobody saved', async () => {
    const { history } = await setup();
    const result = await history.execute({ id: '00000000-0000-4000-8000-0000000000ff' });
    expect(!result.ok && result.error).toBeInstanceOf(SpecIdNotFoundError);
  });
});
