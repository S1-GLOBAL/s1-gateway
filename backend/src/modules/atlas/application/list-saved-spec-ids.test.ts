import { describe, expect, it } from 'vitest';
import type { Clock } from '../../../shared/application/ports/clock.js';
import { SequentialIdGenerator } from '../../../shared/application/testing/fakes.js';
import { ListSavedSpecIds } from './list-saved-spec-ids.js';
import { SaveSpecId } from './save-spec-id.js';
import { InMemoryDictionaryRepository } from './testing/in-memory-dictionary-repository.js';
import { InMemorySpecIdRepository } from './testing/in-memory-spec-id-repository.js';
import { UpdateSpecId } from './update-spec-id.js';

const SAVER = { id: '00000000-0000-4000-8000-0000000000aa', fullName: 'Ada Invented' };

/** A clock that moves on a minute every time it is read, so every save has its own time. */
class TickingClock implements Clock {
  private minutes = 0;

  now(): Date {
    this.minutes += 1;
    return new Date(Date.UTC(2026, 9, 17, 8, this.minutes));
  }
}

/** `count` lids that differ only in height, saved a minute apart, named "Lid 1"… */
async function setup(count: number) {
  const dictionaries = new InMemoryDictionaryRepository();
  const specIds = new InMemorySpecIdRepository();
  specIds.nameSaver(SAVER.id, SAVER.fullName);
  const clock = new TickingClock();
  const ids = new SequentialIdGenerator();
  const save = new SaveSpecId(dictionaries, specIds, clock, ids);
  const savedIds: string[] = [];
  for (let n = 1; n <= count; n += 1) {
    const saved = await save.execute({
      name: `Lid ${n}`,
      facts: { productType: 'BLD', material: 'APS', height: { value: String(n), unit: 'mm' } },
      savedBy: SAVER,
    });
    if (!saved.ok) throw saved.error;
    savedIds.push(saved.value.id);
  }
  return {
    list: new ListSavedSpecIds(dictionaries, specIds),
    update: new UpdateSpecId(dictionaries, specIds, clock, ids),
    save,
    savedIds,
  };
}

describe('ListSavedSpecIds', () => {
  it('answers 20, newest first, and a cursor whose page holds the 21st newest', async () => {
    const { list } = await setup(21);

    const first = await list.execute({});
    if (!first.ok) throw first.error;
    expect(first.value.items).toHaveLength(20);
    expect(first.value.items[0]?.name).toBe('Lid 21');
    expect(first.value.items[19]?.name).toBe('Lid 2');
    expect(first.value.nextCursor).not.toBeNull();

    const second = await list.execute({ cursor: first.value.nextCursor });
    if (!second.ok) throw second.error;
    expect(second.value.items.map((item) => item.name)).toEqual(['Lid 1']);
    expect(second.value.nextCursor).toBeNull();
  });

  it('answers no cursor when exactly 20 are saved', async () => {
    const { list } = await setup(20);
    const result = await list.execute({});
    if (!result.ok) throw result.error;
    expect(result.value.items).toHaveLength(20);
    expect(result.value.nextCursor).toBeNull();
  });

  it('answers an empty page when nothing is saved', async () => {
    const { list } = await setup(0);
    expect(await list.execute({})).toEqual({ ok: true, value: { items: [], nextCursor: null } });
  });

  it('puts a Spec ID changed last first', async () => {
    const { list, update, savedIds } = await setup(3);
    await update.execute({
      id: savedIds[0] ?? '',
      name: 'Lid 1, renamed',
      facts: { productType: 'BLD', material: 'APS', height: { value: '1', unit: 'mm' } },
      version: 1,
      updatedBy: SAVER,
    });

    const result = await list.execute({});

    if (!result.ok) throw result.error;
    expect(result.value.items.map((item) => item.name)).toEqual(['Lid 1, renamed', 'Lid 3', 'Lid 2']);
  });

  it('finds by part of the name, ignoring case and surrounding spaces', async () => {
    const { list } = await setup(12);
    const result = await list.execute({ q: '  LID 1 ' });
    if (!result.ok) throw result.error;
    expect(result.value.items.map((item) => item.name)).toEqual(['Lid 12', 'Lid 11', 'Lid 10', 'Lid 1']);
  });

  it('filters by product type, and treats an empty filter as none', async () => {
    const { list, save } = await setup(2);
    await save.execute({ name: 'Bowl', facts: { productType: 'BWL', material: 'BKR' }, savedBy: SAVER });

    const bowls = await list.execute({ productType: 'BWL' });
    const all = await list.execute({ productType: '', q: '' });

    expect(bowls.ok && bowls.value.items.map((item) => item.name)).toEqual(['Bowl']);
    expect(all.ok && all.value.items).toHaveLength(3);
  });

  it('names each bad filter under its own key', async () => {
    const { list } = await setup(0);

    const result = await list.execute({
      colour: 'CL',
      productType: 'QQQ',
      cursor: 'not-a-cursor',
      q: ['a', 'b'],
    });

    expect(!result.ok && result.error.code).toBe('VALIDATION_FAILED');
    expect(!result.ok && result.error.details).toEqual({
      fields: {
        colour: ['Not a filter of the library.'],
        productType: ['Product type: QQQ is not in the dictionary.'],
        cursor: ['Not a page of this list. Start again from the first page.'],
        q: ['Choose one value.'],
      },
    });
  });

  it('refuses search text over 120 characters', async () => {
    const { list } = await setup(0);
    const result = await list.execute({ q: 'a'.repeat(121) });
    expect(!result.ok && result.error.details).toEqual({ fields: { q: ['Search text must be at most 120 characters.'] } });
  });
});
