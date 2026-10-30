import { describe, expect, it } from 'vitest';
import { FixedClock, SequentialIdGenerator } from '../../../shared/application/testing/fakes.js';
import type { DictionaryRepository } from '../domain/dictionary-repository.js';
import type { SpecIdFactsInput } from '../domain/spec-id.js';
import type { Proposal } from '../domain/suggestions/proposal.js';
import {
  DictionaryMovedOnError,
  SpecIdMovedOnError,
  SpecIdsWouldClashError,
  SuggestionOutOfDateError,
} from '../domain/suggestions/suggestion.errors.js';
import { ApproveDictionarySuggestion } from './approve-dictionary-suggestion.js';
import { GetDictionary } from './get-dictionary.js';
import { GetDictionarySuggestion } from './get-dictionary-suggestion.js';
import { GetSpecIdHistory } from './get-spec-id-history.js';
import { SaveSpecId } from './save-spec-id.js';
import { SuggestDictionaryChange } from './suggest-dictionary-change.js';
import { InMemoryDictionaryChangeStore } from './testing/in-memory-dictionary-change-store.js';
import { InMemoryDictionaryRepository } from './testing/in-memory-dictionary-repository.js';
import { InMemorySourcingRepository } from './testing/in-memory-sourcing-repository.js';
import { InMemorySpecIdRepository } from './testing/in-memory-spec-id-repository.js';
import { InMemorySuggestionRepository } from './testing/in-memory-suggestion-repository.js';
import { UpdateSpecId } from './update-spec-id.js';
import { CAPACITY_UNIT, MATERIAL, PRODUCT_TYPE, PROFILE, SHAPE, WALL } from '../domain/options.js';

const ADA = { id: '00000000-0000-4000-8000-0000000000aa', fullName: 'Ada Invented', isAdmin: false };
const BEN = { id: '00000000-0000-4000-8000-0000000000bb', fullName: 'Ben Invented', isAdmin: true };
const NOW = new Date('2026-10-27T08:00:00.000Z');

const lid = (topDiameter: string, material: string = MATERIAL.ps): SpecIdFactsInput => ({
  productType: PRODUCT_TYPE.bowlLid,
  material,
  shape: SHAPE.round,
  profile: PROFILE.dome,
  topDiameter: { value: topDiameter, unit: 'mm' },
});

function setup() {
  const dictionaries = new InMemoryDictionaryRepository();
  const specIds = new InMemorySpecIdRepository();
  const suggestions = new InMemorySuggestionRepository();
  for (const person of [ADA, BEN]) {
    specIds.nameSaver(person.id, person.fullName);
    suggestions.nameAccount(person.id, person.fullName);
  }
  const store = new InMemoryDictionaryChangeStore(dictionaries, specIds, suggestions);
  const clock = new FixedClock(NOW);
  const ids = new SequentialIdGenerator();
  const sourcing = new InMemorySourcingRepository();
  return {
    dictionaries,
    specIds,
    store,
    sourcing,
    clock,
    ids,
    save: new SaveSpecId(dictionaries, specIds, sourcing, clock, ids),
    update: new UpdateSpecId(dictionaries, specIds, sourcing, clock, ids),
    suggest: new SuggestDictionaryChange(dictionaries, specIds, suggestions, clock, ids),
    approve: new ApproveDictionarySuggestion(dictionaries, specIds, suggestions, store, clock, ids),
    get: new GetDictionarySuggestion(dictionaries, suggestions, specIds),
  };
}

async function saved(context: ReturnType<typeof setup>, name: string, facts: SpecIdFactsInput) {
  const result = await context.save.execute({ name, facts, savedBy: ADA });
  if (!result.ok) throw result.error;
  return result.value;
}

async function suggested(context: ReturnType<typeof setup>, slot: 'material' | 'productType', code: string, proposal: Proposal) {
  const result = await context.suggest.execute({ target: { slot, code }, proposal, by: ADA });
  if (!result.ok) throw result.error;
  return result.value;
}

/** Saved Spec IDs holding polystyrene become not known: a change that rewrites them. */
const DELETE_PS: Proposal = { kind: 'delete', replacement: 'Y' };
/** A new option names no number: it is numbered when it is approved (ADR 0033). */
const add = (meaning: string): Proposal => ({ kind: 'add', meaning, searchWords: [], rules: null });

describe('ApproveDictionarySuggestion', () => {
  it('rewords a material used by 3 saved Spec IDs, changing none of their codes, versions or histories', async () => {
    const context = setup();
    const lids = [await saved(context, 'Lid 90', lid('90')), await saved(context, 'Lid 95', lid('95')), await saved(context, 'Lid 100', lid('100'))];
    const { id } = await suggested(context, 'material', MATERIAL.ps, { kind: 'edit', newCode: null, meaning: 'Polymer, polystyrene', searchWords: null });

    const preview = await context.get.execute({ id });
    expect(preview.ok && preview.value.rewrites).toEqual([]);

    const result = await context.approve.execute({ id, version: 1, by: BEN });

    expect(result.ok && result.value).toMatchObject({ changeNumber: 1, specIdsRewritten: 0, suggestion: { state: 'approved' } });
    expect(lids.map((one) => one.code)).toEqual(['A1B4E1F1-H90', 'A1B4E1F1-H95', 'A1B4E1F1-H100']);
    for (const one of lids) {
      const record = await context.specIds.findById(one.id);
      expect(record?.savedSpecId.specId.code).toBe(one.code);
      expect(record?.savedSpecId.specId.slot('material')).toBe(MATERIAL.ps);
      expect(record?.savedSpecId.version).toBe(1);
      expect(record?.savedSpecId.updatedBy).toBeNull();
      const history = await context.specIds.history(one.id);
      expect(history.map(({ change }) => change.kind)).toEqual(['created']);
    }
    const history = await new GetSpecIdHistory(context.dictionaries, context.specIds).execute({ id: lids[0]!.id });
    expect(history.ok && history.value.map((entry) => entry.dictionaryChange)).toEqual([null]);
    const dictionary = await new GetDictionary(context.dictionaries).execute();
    expect(dictionary.change).toEqual({ number: 1, at: NOW.toISOString() });
    const materials = dictionary.slots.find((slot) => slot.key === 'material')?.values ?? [];
    expect(materials.find((value) => value.code === MATERIAL.ps)).toMatchObject({ number: 4, meaning: 'Polymer, polystyrene' });
  });

  it('numbers a new option when it is approved, the next in its list, in the order approved', async () => {
    const context = setup();
    const first = await suggested(context, 'material', '', add('Polymer, invented'));
    const second = await suggested(context, 'material', '', add('Polymer, another'));
    expect(first.code).toBe('');

    await context.approve.execute({ id: second.id, version: 1, by: BEN });
    await context.approve.execute({ id: first.id, version: 1, by: BEN });

    const dictionary = await new GetDictionary(context.dictionaries).execute();
    const materials = dictionary.slots.find((slot) => slot.key === 'material')?.values ?? [];
    expect(materials.slice(-2).map(({ code, number, meaning }) => ({ code, number, meaning }))).toEqual([
      { code: '39', number: 39, meaning: 'Polymer, another' },
      { code: '40', number: 40, meaning: 'Polymer, invented' },
    ]);
  });

  it('turns a field a rules change rules out to X on every Spec ID of that product type, with a history entry naming the change', async () => {
    const context = setup();
    const cup = (value: string): SpecIdFactsInput => ({
      productType: PRODUCT_TYPE.cup,
      material: MATERIAL.cupStock,
      shape: SHAPE.round,
      wall: WALL.doubleWall,
      capacity: { unit: CAPACITY_UNIT.ounces, value },
    });
    const cups = [await saved(context, 'Cup 12', cup('12')), await saved(context, 'Cup 16', cup('16'))];
    const { id } = await suggested(context, 'productType', PRODUCT_TYPE.cup, { kind: 'rules', rules: { wall: 'never' } });

    const result = await context.approve.execute({ id, version: 1, by: BEN });

    expect(result.ok && result.value.specIdsRewritten).toBe(2);
    expect(cups.map((one) => one.code)).toEqual(['A5B17E1Q2-G112', 'A5B17E1Q2-G116']);
    for (const one of cups) {
      const record = await context.specIds.findById(one.id);
      expect(record?.savedSpecId.specId.slot('wall')).toBe('X');
      expect(record?.savedSpecId.specId.code).toBe(one.code.replace('Q2', ''));
      expect(record?.savedSpecId.version).toBe(2);
      expect(record?.savedSpecId.updatedBy).toBe(BEN.id);
      const [latest] = await context.specIds.history(one.id);
      expect(latest?.change).toMatchObject({
        kind: 'updated',
        changedBy: BEN.id,
        dictionaryChangeNumber: 1,
        codeBefore: one.code,
        codeAfter: one.code.replace('Q2', ''),
      });
    }
    const history = await new GetSpecIdHistory(context.dictionaries, context.specIds).execute({ id: cups[0]!.id });
    expect(history.ok && history.value[0]?.dictionaryChange).toEqual({
      number: 1,
      suggestedBy: { id: ADA.id, fullName: 'Ada Invented' },
      approvedBy: { id: BEN.id, fullName: 'Ben Invented' },
    });
    expect(history.ok && history.value[1]?.dictionaryChange).toBeNull();
  });

  it('refuses a deletion whose replacement would make two Spec IDs one, naming both, and changes nothing', async () => {
    const context = setup();
    const ps = await saved(context, 'PS lid', lid('90'));
    const pp = await saved(context, 'PP lid', lid('90', MATERIAL.pp));
    const { id } = await suggested(context, 'material', MATERIAL.ps, { kind: 'delete', replacement: MATERIAL.pp });

    const result = await context.approve.execute({ id, version: 1, by: BEN });

    expect(!result.ok && result.error).toBeInstanceOf(SpecIdsWouldClashError);
    expect(!result.ok && result.error.message).toBe(
      `Approving this would make saved Spec IDs identical: ${ps.code} and ${pp.code}. Edit or reject the suggestion.`,
    );
    expect(context.store.applied).toEqual([]);
  });

  it('refuses when a Spec ID it rewrites changed while it was being approved, and writes nothing', async () => {
    const context = setup();
    const one = await saved(context, 'Lid 90', lid('90'));
    const { id } = await suggested(context, 'material', MATERIAL.ps, DELETE_PS);
    // Someone edits the Spec ID between the plan and the store: the store sees a newer version.
    const store = context.store;
    const original = store.apply.bind(store);
    store.apply = async (plan) => {
      await context.update.execute({ id: one.id, name: 'Lid 90, renamed', facts: lid('90'), version: 1, updatedBy: ADA });
      return original(plan);
    };

    const result = await context.approve.execute({ id, version: 1, by: BEN });

    expect(!result.ok && result.error).toBeInstanceOf(SpecIdMovedOnError);
    expect((await new GetDictionary(context.dictionaries).execute()).change).toBeNull();
  });

  it('refuses when another approval landed in between', async () => {
    const context = setup();
    const { id } = await suggested(context, 'material', '', add('Polymer, invented'));
    const other = await suggested(context, 'material', '', add('Polymer, another'));
    const store = context.store;
    const original = store.apply.bind(store);
    let first = true;
    store.apply = async (plan) => {
      if (first) {
        first = false;
        await context.approve.execute({ id: other.id, version: 1, by: BEN });
      }
      return original(plan);
    };

    const result = await context.approve.execute({ id, version: 1, by: BEN });
    expect(!result.ok && result.error).toBeInstanceOf(DictionaryMovedOnError);
  });

  it('checks the suggestion again on approval', async () => {
    const context = setup();
    const { id } = await suggested(context, 'material', MATERIAL.ps, { kind: 'delete', replacement: null });
    await saved(context, 'Lid 90', lid('90'));

    const result = await context.approve.execute({ id, version: 1, by: BEN });

    expect(!result.ok && result.error).toBeInstanceOf(SuggestionOutOfDateError);
    expect(!result.ok && result.error.message).toBe(
      'The dictionary changed since this was suggested: Pick what those Spec IDs become. The suggester can edit it, or you can reject it.',
    );
  });

  it('numbers changes in the order approved', async () => {
    const context = setup();
    const first = await suggested(context, 'material', '', add('Polymer, invented'));
    const second = await suggested(context, 'material', '', add('Polymer, another'));
    const one = await context.approve.execute({ id: second.id, version: 1, by: BEN });
    const two = await context.approve.execute({ id: first.id, version: 1, by: BEN });
    expect([one.ok && one.value.changeNumber, two.ok && two.value.changeNumber]).toEqual([1, 2]);
  });

  /** The dictionary as it is, but the first read lets `meanwhile` land first: a write built from it is out of date. */
  function readBefore(context: ReturnType<typeof setup>, meanwhile: () => Promise<unknown>): DictionaryRepository {
    let landed = false;
    return {
      get: async (release) => {
        const dictionary = await context.dictionaries.get(release);
        if (!landed) {
          landed = true;
          await meanwhile();
        }
        return dictionary;
      },
    };
  }

  it('refuses when a Spec ID came to hold the option while it was being approved, and writes nothing', async () => {
    const context = setup();
    await saved(context, 'Lid 90', lid('90'));
    const { id } = await suggested(context, 'material', MATERIAL.ps, DELETE_PS);
    const store = context.store;
    const original = store.apply.bind(store);
    store.apply = async (plan) => {
      await saved(context, 'Lid 95', lid('95'));
      return original(plan);
    };

    const result = await context.approve.execute({ id, version: 1, by: BEN });

    expect(!result.ok && result.error).toBeInstanceOf(SpecIdMovedOnError);
    expect((await new GetDictionary(context.dictionaries).execute()).change).toBeNull();
  });

  it('checks a save again against the dictionary an approval left while it was being made', async () => {
    const context = setup();
    const { id } = await suggested(context, 'material', MATERIAL.ps, { kind: 'delete', replacement: null });
    const approve = () => context.approve.execute({ id, version: 1, by: BEN });
    const save = new SaveSpecId(readBefore(context, approve), context.specIds, context.sourcing, context.clock, context.ids);

    const result = await save.execute({ name: 'Lid 90', facts: lid('90'), savedBy: ADA });

    expect(!result.ok && result.error.code).toBe('INVALID_SPEC_ID');
    expect(await context.specIds.usageOf('material', MATERIAL.ps)).toBe(0);
  });

  it('checks a change again against the dictionary an approval left while it was being made', async () => {
    const context = setup();
    const pp = await saved(context, 'PP lid', lid('90', MATERIAL.pp));
    const { id } = await suggested(context, 'material', MATERIAL.ps, { kind: 'delete', replacement: null });
    const approve = () => context.approve.execute({ id, version: 1, by: BEN });
    const update = new UpdateSpecId(readBefore(context, approve), context.specIds, context.sourcing, context.clock, context.ids);

    const result = await update.execute({ id: pp.id, name: 'PP lid', facts: lid('90'), version: 1, updatedBy: ADA });

    expect(!result.ok && result.error.code).toBe('INVALID_SPEC_ID');
    expect(await context.specIds.usageOf('material', MATERIAL.ps)).toBe(0);
  });
});
