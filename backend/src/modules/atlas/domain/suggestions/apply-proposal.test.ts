import { describe, expect, it } from 'vitest';
import { CAPACITY_UNIT, MATERIAL, PRODUCT_TYPE, PROFILE, SHAPE, WALL } from '../options.js';
import { RULED_SLOTS, type RuledSlotKey, type SlotRule } from '../slots.js';
import { SpecId, type SpecIdFactsInput } from '../spec-id.js';
import { s2Dictionary } from '../testing/s2-dictionary.js';
import { slotsOf } from '../testing/slots-of.js';
import { applyProposal, rewriteSpecId, rewritesSpecIds } from './apply-proposal.js';
import type { Proposal, SuggestionTarget } from './proposal.js';

const dictionary = s2Dictionary();
const STAMP = { number: 1, at: new Date('2026-10-27T10:00:00.000Z') };
const LATER = { number: 2, at: new Date('2026-10-27T11:00:00.000Z') };

function built(facts: SpecIdFactsInput, using = dictionary): SpecId {
  const result = SpecId.build(facts, using);
  if (!result.ok) throw new Error(JSON.stringify(result.error.issues));
  return result.value;
}

const LID: SpecIdFactsInput = { productType: PRODUCT_TYPE.bowlLid, material: MATERIAL.ps, shape: SHAPE.round, profile: PROFILE.dome, topDiameter: { value: '90', unit: 'mm' } };
const CUP: SpecIdFactsInput = { productType: PRODUCT_TYPE.cup, material: MATERIAL.cupStock, shape: SHAPE.round, wall: WALL.doubleWall, capacity: { unit: CAPACITY_UNIT.ounces, value: '16' } };

function approve(target: SuggestionTarget, proposal: Proposal, specId: SpecId, stamp = STAMP) {
  const next = applyProposal(dictionary, target, proposal, stamp);
  const rewritten = rewriteSpecId(specId, target, proposal, next);
  if (!rewritten.ok) throw new Error(JSON.stringify(rewritten.error.issues));
  // The slots joined by dots: what each test checks. The code itself is in `specId`.
  return { next, code: slotsOf(rewritten.value), specId: rewritten.value };
}

describe('applyProposal', () => {
  it('adds an option under the next number in its list, with its search words, stamped with the change', () => {
    const next = applyProposal(
      dictionary,
      { slot: 'material', code: '' },
      { kind: 'add', meaning: 'Polymer, invented', searchWords: ['invented polymer'], rules: null },
      STAMP,
    );
    // Its key is its number, as text (ADR 0033).
    expect(next.meaningOf('material', '39')).toBe('Polymer, invented');
    expect(next.numberOf('material', '39')).toBe(39);
    expect(next.searchWordsOf('material', '39')).toEqual(['invented polymer']);
    expect(next.change).toEqual(STAMP);
    expect(next.values()).toHaveLength(dictionary.values().length + 1);
    expect(dictionary.meaningOf('material', '39')).toBeUndefined();
  });

  it('adds a material as a grade of the one named, and one named with none as a grade of nothing', () => {
    const graded = applyProposal(
      dictionary,
      { slot: 'material', code: '' },
      { kind: 'add', meaning: 'Polymer, invented', searchWords: [], rules: null, broader: MATERIAL.polymer },
      STAMP,
    );
    expect(graded.broaderOf('39')).toBe(MATERIAL.polymer);
    expect(graded.isGradeOf('39', MATERIAL.polymer)).toBe(true);

    const alone = applyProposal(
      dictionary,
      { slot: 'material', code: '' },
      { kind: 'add', meaning: 'Stone, invented', searchWords: [], rules: null, broader: null },
      STAMP,
    );
    expect(alone.broaderOf('39')).toBeUndefined();
  });

  it('never gives a deleted number again', () => {
    const deleted = applyProposal(dictionary, { slot: 'material', code: MATERIAL.cpe }, { kind: 'delete', replacement: null }, STAMP);
    const added = applyProposal(deleted, { slot: 'material', code: '' }, { kind: 'add', meaning: 'Polymer, invented', searchWords: [], rules: null }, LATER);
    expect(added.meaningOf('material', MATERIAL.cpe)).toBeUndefined();
    expect(added.meaningOf('material', '39')).toBe('Polymer, invented');
  });

  it('adds a product type with a rule for every ruled field', () => {
    const rules = Object.fromEntries(RULED_SLOTS.map((slot) => [slot, 'never'])) as Record<RuledSlotKey, SlotRule>;
    const next = applyProposal(dictionary, { slot: 'productType', code: '' }, { kind: 'add', meaning: 'Invented', searchWords: [], rules }, STAMP);
    expect(RULED_SLOTS.every((slot) => next.ruleFor('37', slot) === 'never')).toBe(true);
  });

  it('changes the wording and the words, keeping the number and the rules', () => {
    const next = applyProposal(
      dictionary,
      { slot: 'productType', code: PRODUCT_TYPE.cup },
      { kind: 'edit', newCode: null, meaning: 'Cup, reworded', searchWords: ['tumbler'] },
      STAMP,
    );
    expect(next.meaningOf('productType', PRODUCT_TYPE.cup)).toBe('Cup, reworded');
    expect(next.numberOf('productType', PRODUCT_TYPE.cup)).toBe(5);
    expect(next.ruleFor(PRODUCT_TYPE.cup, 'wall')).toBe(dictionary.ruleFor(PRODUCT_TYPE.cup, 'wall'));
    expect(next.searchWordsOf('productType', PRODUCT_TYPE.cup)).toEqual(['tumbler']);
    expect(next.renames()).toEqual([]);
  });

  it('deletes an option, its rules and its words, and remembers it is gone', () => {
    const worded = applyProposal(dictionary, { slot: 'productType', code: PRODUCT_TYPE.cup }, { kind: 'edit', newCode: null, meaning: null, searchWords: ['tumbler'] }, STAMP);
    const next = applyProposal(worded, { slot: 'productType', code: PRODUCT_TYPE.cup }, { kind: 'delete', replacement: PRODUCT_TYPE.bowl }, LATER);
    expect(next.meaningOf('productType', PRODUCT_TYPE.cup)).toBeUndefined();
    expect(next.slotRules().some((entry) => entry.productType === PRODUCT_TYPE.cup)).toBe(false);
    expect(worded.searchWordsOf('productType', PRODUCT_TYPE.cup)).toEqual(['tumbler']);
    expect(next.searchWords()).toEqual([]);
    expect(next.live('productType', PRODUCT_TYPE.cup)).toBeUndefined();
  });

  it("keeps a deleted option's old letters, so a dotted code written with them still reads (ADR 0033)", () => {
    const next = applyProposal(dictionary, { slot: 'material', code: MATERIAL.ps }, { kind: 'delete', replacement: null }, STAMP);
    expect(next.retired()).toEqual([
      { slot: 'material', number: 4, code: MATERIAL.ps, meaning: 'Polymer, PS (polystyrene)', changeNumber: 1, legacyCode: 'APS' },
    ]);
    expect(next.fromLetters('material', 'APS')).toBe(MATERIAL.ps);
  });

  it("makes a deleted material's grades grades of what it was a grade of", () => {
    const next = applyProposal(dictionary, { slot: 'material', code: MATERIAL.kraft }, { kind: 'delete', replacement: null }, STAMP);
    expect(next.broaderOf(MATERIAL.recycledKraft)).toBe(MATERIAL.paper);
    expect(next.isGradeOf(MATERIAL.recycledKraft, MATERIAL.paper)).toBe(true);

    const top = applyProposal(dictionary, { slot: 'material', code: MATERIAL.paper }, { kind: 'delete', replacement: null }, STAMP);
    expect(top.broaderOf(MATERIAL.kraft)).toBeUndefined();
    expect(top.broaderOf(MATERIAL.recycledKraft)).toBe(MATERIAL.kraft);
  });

  it('changes only the rules a rules change names', () => {
    const next = applyProposal(dictionary, { slot: 'productType', code: PRODUCT_TYPE.cup }, { kind: 'rules', rules: { coating: 'never' } }, STAMP);
    expect(next.ruleFor(PRODUCT_TYPE.cup, 'coating')).toBe('never');
    expect(next.ruleFor(PRODUCT_TYPE.cup, 'wall')).toBe(dictionary.ruleFor(PRODUCT_TYPE.cup, 'wall'));
    expect(next.ruleFor(PRODUCT_TYPE.bowl, 'coating')).toBe(dictionary.ruleFor(PRODUCT_TYPE.bowl, 'coating'));
  });
});

describe('rewriteSpecId', () => {
  it('replaces a deleted option with the one named, or with Not known', () => {
    const lid = built(LID);
    expect(approve({ slot: 'material', code: MATERIAL.ps }, { kind: 'delete', replacement: MATERIAL.pp }, lid).code).toBe(
      slotsOf(lid).replace(`.${MATERIAL.ps}.`, `.${MATERIAL.pp}.`),
    );
    expect(approve({ slot: 'material', code: MATERIAL.ps }, { kind: 'delete', replacement: 'Y' }, lid).specId.slot('material')).toBe('Y');
  });

  it('turns a paper-only field from X to Y when the material it depends on becomes not known', () => {
    const lid = built(LID);
    expect(lid.slot('basisWeight')).toBe('X');
    const unknown = approve({ slot: 'material', code: MATERIAL.ps }, { kind: 'delete', replacement: 'Y' }, lid).specId;
    expect(unknown.slot('material')).toBe('Y');
    expect(unknown.slot('basisWeight')).toBe('Y');
  });

  it("keeps a capacity's amount under the unit a deleted one's Spec IDs move to, and clears it to Y when its unit becomes not known", () => {
    const cup = built(CUP);
    const capacity = cup.slot('capacity');
    expect(approve({ slot: 'capacity', code: CAPACITY_UNIT.ounces }, { kind: 'delete', replacement: CAPACITY_UNIT.millilitres }, cup).code).toBe(
      slotsOf(cup).replace(`.${capacity}.`, `.${CAPACITY_UNIT.millilitres}${capacity.slice(1)}.`),
    );
    expect(approve({ slot: 'capacity', code: CAPACITY_UNIT.ounces }, { kind: 'delete', replacement: 'Y' }, cup).code).toBe(
      slotsOf(cup).replace(`.${capacity}.`, '.Y.'),
    );
  });

  it('turns a field to X when its rule becomes never, and from X to Y when it starts to apply', () => {
    const cup = built(CUP);
    const never = approve({ slot: 'productType', code: PRODUCT_TYPE.cup }, { kind: 'rules', rules: { wall: 'never' } }, cup);
    expect(never.specId.slot('wall')).toBe('X');

    expect(cup.slot('profile')).toBe('X');
    const applies = approve({ slot: 'productType', code: PRODUCT_TYPE.cup }, { kind: 'rules', rules: { profile: 'applies' } }, cup);
    expect(applies.specId.slot('profile')).toBe('Y');
  });

  it("refits every field to the product type a deleted one's Spec IDs move to", () => {
    const cup = built(CUP);
    const { next, specId: moved } = approve({ slot: 'productType', code: PRODUCT_TYPE.cup }, { kind: 'delete', replacement: PRODUCT_TYPE.bowl }, cup);
    expect(moved.slot('productType')).toBe(PRODUCT_TYPE.bowl);
    // Whatever a bowl rules, every ruled field now fits it: reading the code with `next` passed.
    expect(SpecId.parse(moved.code, next).ok).toBe(true);
  });

  it('leaves a Spec ID the change does not touch as it was', () => {
    const lid = built(LID);
    expect(approve({ slot: 'material', code: MATERIAL.pp }, { kind: 'delete', replacement: 'Y' }, lid).code).toBe(slotsOf(lid));
    const reworded = approve({ slot: 'material', code: MATERIAL.ps }, { kind: 'edit', newCode: null, meaning: 'Polymer, PS', searchWords: null }, lid);
    expect(reworded.specId.code).toBe(lid.code);
  });
});

describe('rewritesSpecIds', () => {
  it('is true for a deletion or a rules change, and false for an add or an edit, which keeps the number', () => {
    expect(rewritesSpecIds({ kind: 'delete', replacement: null })).toBe(true);
    expect(rewritesSpecIds({ kind: 'rules', rules: { coating: 'never' } })).toBe(true);
    expect(rewritesSpecIds({ kind: 'edit', newCode: null, meaning: 'x', searchWords: null })).toBe(false);
    expect(rewritesSpecIds({ kind: 'add', meaning: 'x', searchWords: [], rules: null })).toBe(false);
  });
});
