import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { connectTestDatabase, resetTables } from '../../../test/database.js';
import type { DictionaryValue, SlotRuleEntry } from '../domain/dictionary.js';
import { S1_0_1_0_RULES, S1_0_1_0_VALUES } from '../domain/testing/s1-dictionary.js';
import { S2_0_1_0_RULES, S2_0_1_0_VALUES } from '../domain/testing/s2-dictionary.js';
import { DrizzleDictionaryRepository } from './drizzle-dictionary-repository.js';

const connection = connectTestDatabase();
const repository = new DrizzleDictionaryRepository(connection.db);

const valueKeys = (values: readonly DictionaryValue[]) =>
  values.map((value) => `${value.slot} ${value.code} ${value.meaning}`).sort();
const ruleKeys = (rules: readonly SlotRuleEntry[]) =>
  rules.map((entry) => `${entry.productType} ${entry.slot} ${entry.rule}`).sort();

// resetTables puts the dictionary back as the migrations made it, whatever a test before approved.
beforeEach(() => resetTables(connection.db));
afterAll(() => connection.close());

describe('DrizzleDictionaryRepository', () => {
  it('reads release S1 0.1.0 exactly as the seed migration loaded it', async () => {
    const dictionary = await repository.get('S1 0.1.0');

    expect(dictionary?.release).toBe('S1 0.1.0');
    expect(dictionary?.approvedOn).toBe('2026-10-16');
    expect(dictionary?.values()).toHaveLength(28);
    expect(dictionary?.slotRules()).toHaveLength(56);
    expect(valueKeys(dictionary?.values() ?? [])).toEqual(valueKeys(S1_0_1_0_VALUES));
    expect(ruleKeys(dictionary?.slotRules() ?? [])).toEqual(ruleKeys(S1_0_1_0_RULES));
  });

  it('reads release S2 0.1.0 exactly as the seed migration loaded it', async () => {
    const dictionary = await repository.get('S2 0.1.0');

    expect(dictionary?.release).toBe('S2 0.1.0');
    expect(dictionary?.approvedOn).toBe('2026-10-19');
    expect(dictionary?.values()).toHaveLength(118);
    expect(dictionary?.slotRules()).toHaveLength(682);
    expect(valueKeys(dictionary?.values() ?? [])).toEqual(valueKeys(S2_0_1_0_VALUES));
    expect(ruleKeys(dictionary?.slotRules() ?? [])).toEqual(ruleKeys(S2_0_1_0_RULES));
  });

  it('answers null for a release that does not exist', async () => {
    expect(await repository.get('S9 9.9.9')).toBeNull();
  });
});
