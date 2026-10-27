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

const ADA = { id: '00000000-0000-4000-8000-0000000000aa', fullName: 'Ada Invented', isAdmin: false };
const BEN = { id: '00000000-0000-4000-8000-0000000000bb', fullName: 'Ben Invented', isAdmin: true };
const NOW = new Date('2026-10-27T08:00:00.000Z');

const lid = (topDiameter: string, material = 'APS'): SpecIdFactsInput => ({
  productType: 'BLD',
  material,
  shape: 'RD',
  profile: 'DM',
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

const RENAME_APS: Proposal = { kind: 'edit', newCode: 'APZ', meaning: null, searchWords: null };

describe('ApproveDictionarySuggestion', () => {
  it('renames a material used by 3 saved Spec IDs, rewriting each with a history entry naming the change', async () => {
    const context = setup();
    const lids = [await saved(context, 'Lid 90', lid('90')), await saved(context, 'Lid 95', lid('95')), await saved(context, 'Lid 100', lid('100'))];
    await saved(context, 'PP lid', lid('90', 'APP'));
    const { id } = await suggested(context, 'material', 'APS', RENAME_APS);

    const preview = await context.get.execute({ id });
    expect(preview.ok && preview.value.rewrites?.map((rewrite) => rewrite.codeAfter)).toEqual(
      lids.map((one) => one.code.replace('.APS.', '.APZ.')).sort(),
    );

    const result = await context.approve.execute({ id, version: 1, by: BEN });

    expect(result.ok && result.value).toMatchObject({ changeNumber: 1, specIdsRewritten: 3, suggestion: { state: 'approved' } });
    for (const one of lids) {
      const record = await context.specIds.findById(one.id);
      expect(record?.savedSpecId.specId.code).toBe(one.code.replace('.APS.', '.APZ.'));
      expect(record?.savedSpecId.version).toBe(2);
      expect(record?.savedSpecId.updatedBy).toBe(BEN.id);
      const [latest] = await context.specIds.history(one.id);
      expect(latest?.change).toMatchObject({ kind: 'updated', changedBy: BEN.id, dictionaryChangeNumber: 1, codeBefore: one.code });
    }
    const history = await new GetSpecIdHistory(context.dictionaries, context.specIds).execute({ id: lids[0]!.id });
    expect(history.ok && history.value[0]?.dictionaryChange).toEqual({
      number: 1,
      suggestedBy: { id: ADA.id, fullName: 'Ada Invented' },
      approvedBy: { id: BEN.id, fullName: 'Ben Invented' },
    });
    expect(history.ok && history.value[1]?.dictionaryChange).toBeNull();
    const dictionary = await new GetDictionary(context.dictionaries).execute();
    expect(dictionary.change).toEqual({ number: 1, at: NOW.toISOString() });
    expect(dictionary.slots.find((slot) => slot.key === 'material')?.values.some((value) => value.code === 'APS')).toBe(false);
  });

  it('turns a field a rules change rules out to X on every Spec ID of that product type', async () => {
    const context = setup();
    const cup = (value: string): SpecIdFactsInput => ({
      productType: 'CUP',
      material: 'BCS',
      shape: 'RD',
      wall: 'DW',
      capacity: { unit: 'Z', value },
    });
    const cups = [await saved(context, 'Cup 12', cup('12')), await saved(context, 'Cup 16', cup('16'))];
    const { id } = await suggested(context, 'productType', 'CUP', { kind: 'rules', rules: { wall: 'never' } });

    const result = await context.approve.execute({ id, version: 1, by: BEN });

    expect(result.ok && result.value.specIdsRewritten).toBe(2);
    for (const one of cups) {
      const record = await context.specIds.findById(one.id);
      expect(record?.savedSpecId.specId.slot('wall')).toBe('X');
      expect(record?.savedSpecId.version).toBe(2);
    }
  });

  it('refuses a deletion whose replacement would make two Spec IDs one, naming both, and changes nothing', async () => {
    const context = setup();
    const ps = await saved(context, 'PS lid', lid('90'));
    const pp = await saved(context, 'PP lid', lid('90', 'APP'));
    const { id } = await suggested(context, 'material', 'APS', { kind: 'delete', replacement: 'APP' });

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
    const { id } = await suggested(context, 'material', 'APS', RENAME_APS);
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
    const { id } = await suggested(context, 'material', 'AZZ', { kind: 'add', meaning: 'Polymer, invented', searchWords: [], rules: null });
    const other = await suggested(context, 'material', 'AZY', { kind: 'add', meaning: 'Polymer, another', searchWords: [], rules: null });
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
    const { id } = await suggested(context, 'material', 'APS', { kind: 'delete', replacement: null });
    await saved(context, 'Lid 90', lid('90'));

    const result = await context.approve.execute({ id, version: 1, by: BEN });

    expect(!result.ok && result.error).toBeInstanceOf(SuggestionOutOfDateError);
    expect(!result.ok && result.error.message).toBe(
      'The dictionary changed since this was suggested: Pick what those Spec IDs become. The suggester can edit it, or you can reject it.',
    );
  });

  it('numbers changes in the order approved', async () => {
    const context = setup();
    const first = await suggested(context, 'material', 'AZZ', { kind: 'add', meaning: 'Polymer, invented', searchWords: [], rules: null });
    const second = await suggested(context, 'material', 'AZY', { kind: 'add', meaning: 'Polymer, another', searchWords: [], rules: null });
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
    const { id } = await suggested(context, 'material', 'APS', RENAME_APS);
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
    const { id } = await suggested(context, 'material', 'APS', RENAME_APS);
    const approve = () => context.approve.execute({ id, version: 1, by: BEN });
    const save = new SaveSpecId(readBefore(context, approve), context.specIds, context.sourcing, context.clock, context.ids);

    const result = await save.execute({ name: 'Lid 90', facts: lid('90'), savedBy: ADA });

    expect(!result.ok && result.error.code).toBe('INVALID_SPEC_ID');
    expect(await context.specIds.usageOf('material', 'APS')).toBe(0);
  });

  it('checks a change again against the dictionary an approval left while it was being made', async () => {
    const context = setup();
    const pp = await saved(context, 'PP lid', lid('90', 'APP'));
    const { id } = await suggested(context, 'material', 'APS', RENAME_APS);
    const approve = () => context.approve.execute({ id, version: 1, by: BEN });
    const update = new UpdateSpecId(readBefore(context, approve), context.specIds, context.sourcing, context.clock, context.ids);

    const result = await update.execute({ id: pp.id, name: 'PP lid', facts: lid('90'), version: 1, updatedBy: ADA });

    expect(!result.ok && result.error.code).toBe('INVALID_SPEC_ID');
    expect(await context.specIds.usageOf('material', 'APS')).toBe(0);
  });
});
