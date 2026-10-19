import { describe, expect, it } from 'vitest';
import { FixedClock, SequentialIdGenerator } from '../../../shared/application/testing/fakes.js';
import { InvalidSpecIdError, SpecIdChangedError, SpecIdExistsError, SpecIdNotFoundError } from '../domain/spec-id.errors.js';
import { SaveSpecId } from './save-spec-id.js';
import { InMemoryDictionaryRepository } from './testing/in-memory-dictionary-repository.js';
import { InMemorySpecIdRepository } from './testing/in-memory-spec-id-repository.js';
import { UpdateSpecId } from './update-spec-id.js';

const ILLUSTRATIVE = 'BLD.APS.Y.CL.RD.DM.X.0090.X.Y.X.X.X.0033.X.Y.X.Y.X.X.X.X.X.X.X';
const WITH_HEIGHT = 'BLD.APS.Y.CL.RD.DM.X.0090.X.0012.X.X.X.0033.X.Y.X.Y.X.X.X.X.X.X.X';
const FACTS = {
  productType: 'BLD',
  material: 'APS',
  colourClarity: 'CL',
  shape: 'RD',
  profile: 'DM',
  topDiameter: { value: '90', unit: 'mm' },
  unitWeight: { value: '3.3', unit: 'g' },
};
const SAVER = { id: '00000000-0000-4000-8000-0000000000aa', fullName: 'Ada Invented' };
const EDITOR = { id: '00000000-0000-4000-8000-0000000000bb', fullName: 'Ben Invented' };

async function setup() {
  const dictionaries = new InMemoryDictionaryRepository();
  const specIds = new InMemorySpecIdRepository();
  specIds.nameSaver(SAVER.id, SAVER.fullName);
  specIds.nameSaver(EDITOR.id, EDITOR.fullName);
  const ids = new SequentialIdGenerator();
  const save = new SaveSpecId(dictionaries, specIds, new FixedClock(new Date('2026-10-16T08:00:00.000Z')), ids);
  const update = new UpdateSpecId(dictionaries, specIds, new FixedClock(new Date('2026-10-17T08:00:00.000Z')), ids);
  const saved = await save.execute({ name: 'Illustrative lid', facts: FACTS, savedBy: SAVER });
  if (!saved.ok) throw saved.error;
  return { specIds, save, update, id: saved.value.id };
}

describe('UpdateSpecId', () => {
  it('changes the code with the facts, raises the version, and records one change', async () => {
    const { specIds, update, id } = await setup();

    const result = await update.execute({
      id,
      name: 'Illustrative lid',
      facts: { ...FACTS, height: { value: '12', unit: 'mm' } },
      version: 1,
      updatedBy: EDITOR,
    });

    if (!result.ok) throw result.error;
    expect(result.value.code).toBe(WITH_HEIGHT);
    expect(result.value.version).toBe(2);
    expect(result.value.updatedBy).toEqual(EDITOR);
    expect(result.value.updatedAt).toBe('2026-10-17T08:00:00.000Z');
    expect(result.value.savedBy).toEqual(SAVER);
    const history = await specIds.history(id);
    expect(history.map(({ change }) => [change.kind, change.codeBefore, change.codeAfter])).toEqual([
      ['updated', ILLUSTRATIVE, WITH_HEIGHT],
      ['created', null, ILLUSTRATIVE],
    ]);
  });

  it('refuses a change started from an older version, and saves nothing', async () => {
    const { specIds, update, id } = await setup();
    await update.execute({ id, name: 'First change', facts: FACTS, version: 1, updatedBy: EDITOR });

    const result = await update.execute({ id, name: 'Second change', facts: FACTS, version: 1, updatedBy: SAVER });

    expect(!result.ok && result.error).toBeInstanceOf(SpecIdChangedError);
    expect(!result.ok && result.error.message).toBe(
      'Someone changed this Spec ID while you were editing. Reload to see their changes, then make yours again.',
    );
    expect((await specIds.findById(id))?.savedSpecId.name).toBe('First change');
    expect(specIds.changeCount).toBe(2);
  });

  it("refuses facts that give it another saved Spec ID's code, naming that one, and saves nothing", async () => {
    const { specIds, save, update, id } = await setup();
    const other = await save.execute({
      name: 'Lid, 12 mm',
      facts: { ...FACTS, height: { value: '12', unit: 'mm' } },
      savedBy: SAVER,
    });
    if (!other.ok) throw other.error;

    const result = await update.execute({
      id,
      name: 'Illustrative lid',
      facts: { ...FACTS, height: { value: '12', unit: 'mm' } },
      version: 1,
      updatedBy: EDITOR,
    });

    expect(!result.ok && result.error).toBeInstanceOf(SpecIdExistsError);
    const details = !result.ok ? (result.error.details as { existing: { name: string } }) : undefined;
    expect(details?.existing.name).toBe('Lid, 12 mm');
    expect((await specIds.findById(id))?.savedSpecId.specId.code).toBe(ILLUSTRATIVE);
    expect(specIds.changeCount).toBe(2);
  });

  it('records a change of name alone, with the same code before and after', async () => {
    const { specIds, update, id } = await setup();

    const result = await update.execute({ id, name: '  Clear dome lid ', facts: FACTS, version: 1, updatedBy: EDITOR });

    if (!result.ok) throw result.error;
    expect(result.value.name).toBe('Clear dome lid');
    const [latest] = await specIds.history(id);
    expect(latest?.change.codeBefore).toBe(latest?.change.codeAfter);
    expect(latest?.change.nameBefore).toBe('Illustrative lid');
    expect(latest?.change.nameAfter).toBe('Clear dome lid');
  });

  it('answers what is saved, and records nothing, when nothing changes', async () => {
    const { specIds, update, id } = await setup();

    const result = await update.execute({ id, name: 'Illustrative lid', facts: FACTS, version: 1, updatedBy: EDITOR });

    if (!result.ok) throw result.error;
    expect(result.value.version).toBe(1);
    expect(result.value.updatedBy).toBeNull();
    expect(specIds.changeCount).toBe(1);
  });

  it('reports a bad name and a bad slot together, and saves nothing', async () => {
    const { specIds, update, id } = await setup();

    const result = await update.execute({
      id,
      name: ' ',
      facts: { ...FACTS, height: { value: '12000', unit: 'mm' } },
      version: 1,
      updatedBy: EDITOR,
    });

    expect(!result.ok && result.error).toBeInstanceOf(InvalidSpecIdError);
    expect(!result.ok && result.error.details).toEqual({
      fields: { height: ['Height: 12000 mm is outside 1–9999 mm.'], name: ['Name is required.'] },
    });
    expect(specIds.changeCount).toBe(1);
  });

  it('may clear a known fact and change the product type: slots that stop applying become X', async () => {
    const { update, id } = await setup();

    const result = await update.execute({
      id,
      name: 'Illustrative lid',
      facts: { productType: 'BWL', material: 'APS', shape: 'RD', capacity: { unit: 'Z', value: '16' } },
      version: 1,
      updatedBy: EDITOR,
    });

    if (!result.ok) throw result.error;
    expect(result.value.code).toBe('BWL.APS.Y.Y.RD.X.Z0016.Y.Y.Y.X.X.X.Y.X.Y.Y.Y.Y.X.X.X.X.X.X');
  });

  it('answers not found for an id nobody saved', async () => {
    const { update } = await setup();

    const result = await update.execute({
      id: '00000000-0000-4000-8000-0000000000ff',
      name: 'Illustrative lid',
      facts: FACTS,
      version: 1,
      updatedBy: EDITOR,
    });

    expect(!result.ok && result.error).toBeInstanceOf(SpecIdNotFoundError);
    expect(!result.ok && result.error.message).toBe("This Spec ID doesn't exist. It may have been typed wrong.");
  });
});
