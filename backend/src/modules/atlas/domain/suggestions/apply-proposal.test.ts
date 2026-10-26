import { describe, expect, it } from 'vitest';
import { RULED_SLOTS, type RuledSlotKey, type SlotRule } from '../slots.js';
import { SpecId, type SpecIdFactsInput } from '../spec-id.js';
import { s2Dictionary } from '../testing/s2-dictionary.js';
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

const LID: SpecIdFactsInput = { productType: 'BLD', material: 'APS', shape: 'RD', profile: 'DM', topDiameter: { value: '90', unit: 'mm' } };
const CUP: SpecIdFactsInput = { productType: 'CUP', material: 'BCS', shape: 'RD', wall: 'DW', capacity: { unit: 'Z', value: '16' } };

function approve(target: SuggestionTarget, proposal: Proposal, specId: SpecId, stamp = STAMP) {
  const next = applyProposal(dictionary, target, proposal, stamp);
  const rewritten = rewriteSpecId(specId, target, proposal, next);
  if (!rewritten.ok) throw new Error(JSON.stringify(rewritten.error.issues));
  return { next, code: rewritten.value.code };
}

describe('applyProposal', () => {
  it('adds an option with its search words, stamped with the change', () => {
    const next = applyProposal(
      dictionary,
      { slot: 'material', code: 'AZZ' },
      { kind: 'add', meaning: 'Polymer, invented', searchWords: ['invented polymer'], rules: null },
      STAMP,
    );
    expect(next.meaningOf('material', 'AZZ')).toBe('Polymer, invented');
    expect(next.searchWordsOf('material', 'AZZ')).toEqual(['invented polymer']);
    expect(next.change).toEqual(STAMP);
    expect(next.values()).toHaveLength(119);
    expect(dictionary.meaningOf('material', 'AZZ')).toBeUndefined();
  });

  it('adds a product type with a rule for every ruled field', () => {
    const rules = Object.fromEntries(RULED_SLOTS.map((slot) => [slot, 'never'])) as Record<RuledSlotKey, SlotRule>;
    const next = applyProposal(dictionary, { slot: 'productType', code: 'ZZZ' }, { kind: 'add', meaning: 'Invented', searchWords: [], rules }, STAMP);
    expect(RULED_SLOTS.every((slot) => next.ruleFor('ZZZ', slot) === 'never')).toBe(true);
  });

  it('renames a code, moving its rules, words and every earlier rename with it', () => {
    const once = applyProposal(dictionary, { slot: 'productType', code: 'CUP' }, { kind: 'edit', newCode: 'CPX', meaning: null, searchWords: ['tumbler'] }, STAMP);
    const twice = applyProposal(once, { slot: 'productType', code: 'CPX' }, { kind: 'edit', newCode: 'CPY', meaning: 'Cup, renamed', searchWords: null }, LATER);

    expect(twice.meaningOf('productType', 'CPY')).toBe('Cup, renamed');
    expect(twice.meaningOf('productType', 'CUP')).toBeUndefined();
    expect(twice.ruleFor('CPY', 'wall')).toBe(dictionary.ruleFor('CUP', 'wall'));
    expect(twice.searchWordsOf('productType', 'CPY')).toEqual(['tumbler']);
    expect(twice.live('productType', 'CUP')).toBe('CPY');
    expect(twice.live('productType', 'CPX')).toBe('CPY');
  });

  it('deletes an option, its rules and its words, and remembers it is gone', () => {
    const next = applyProposal(dictionary, { slot: 'productType', code: 'CUP' }, { kind: 'delete', replacement: 'BWL' }, STAMP);
    expect(next.meaningOf('productType', 'CUP')).toBeUndefined();
    expect(next.slotRules().some((entry) => entry.productType === 'CUP')).toBe(false);
    expect(next.live('productType', 'CUP')).toBeUndefined();
  });

  it('reads a code a later change brings back as itself, deleted or renamed away before', () => {
    const deleted = applyProposal(dictionary, { slot: 'material', code: 'APS' }, { kind: 'delete', replacement: null }, STAMP);
    const added = applyProposal(deleted, { slot: 'material', code: 'APS' }, { kind: 'add', meaning: 'Polymer, invented', searchWords: [], rules: null }, LATER);
    expect(added.live('material', 'APS')).toBe('APS');

    const renamed = applyProposal(dictionary, { slot: 'material', code: 'APS' }, { kind: 'edit', newCode: 'APZ', meaning: null, searchWords: null }, STAMP);
    const taken = applyProposal(renamed, { slot: 'material', code: 'APP' }, { kind: 'edit', newCode: 'APS', meaning: null, searchWords: null }, LATER);
    expect(taken.live('material', 'APS')).toBe('APS');
    expect(taken.live('material', 'APP')).toBe('APS');
  });

  it('changes only the rules a rules change names', () => {
    const next = applyProposal(dictionary, { slot: 'productType', code: 'CUP' }, { kind: 'rules', rules: { coating: 'never' } }, STAMP);
    expect(next.ruleFor('CUP', 'coating')).toBe('never');
    expect(next.ruleFor('CUP', 'wall')).toBe(dictionary.ruleFor('CUP', 'wall'));
    expect(next.ruleFor('BWL', 'coating')).toBe(dictionary.ruleFor('BWL', 'coating'));
  });
});

describe('rewriteSpecId', () => {
  it("gives a renamed option's Spec IDs the new letters", () => {
    const lid = built(LID);
    const { code } = approve({ slot: 'material', code: 'APS' }, { kind: 'edit', newCode: 'APZ', meaning: null, searchWords: null }, lid);
    expect(code).toBe(lid.code.replace('.APS.', '.APZ.'));
  });

  it('replaces a deleted option with the one named, or with Not known', () => {
    const lid = built(LID);
    expect(approve({ slot: 'material', code: 'APS' }, { kind: 'delete', replacement: 'APP' }, lid).code).toBe(lid.code.replace('.APS.', '.APP.'));
  });

  it('turns a paper-only field from X to Y when the material it depends on becomes not known', () => {
    const lid = built(LID);
    expect(lid.slot('basisWeight')).toBe('X');
    const unknown = SpecId.restoreCode(approve({ slot: 'material', code: 'APS' }, { kind: 'delete', replacement: 'Y' }, lid).code);
    expect(unknown.slot('material')).toBe('Y');
    expect(unknown.slot('basisWeight')).toBe('Y');
  });

  it('keeps a capacity\'s number under a renamed unit, and clears it to Y when its unit becomes not known', () => {
    const cup = built(CUP);
    const capacity = cup.slot('capacity');
    expect(approve({ slot: 'capacity', code: 'Z' }, { kind: 'edit', newCode: 'O', meaning: null, searchWords: null }, cup).code).toBe(
      cup.code.replace(`.${capacity}.`, `.O${capacity.slice(1)}.`),
    );
    expect(approve({ slot: 'capacity', code: 'Z' }, { kind: 'delete', replacement: 'Y' }, cup).code).toBe(cup.code.replace(`.${capacity}.`, '.Y.'));
  });

  it('turns a field to X when its rule becomes never, and from X to Y when it starts to apply', () => {
    const cup = built(CUP);
    const never = approve({ slot: 'productType', code: 'CUP' }, { kind: 'rules', rules: { wall: 'never' } }, cup);
    expect(SpecId.restoreCode(never.code).slot('wall')).toBe('X');

    expect(cup.slot('profile')).toBe('X');
    const applies = approve({ slot: 'productType', code: 'CUP' }, { kind: 'rules', rules: { profile: 'applies' } }, cup);
    expect(SpecId.restoreCode(applies.code).slot('profile')).toBe('Y');
  });

  it("refits every field to the product type a deleted one's Spec IDs move to", () => {
    const cup = built(CUP);
    const { next, code } = approve({ slot: 'productType', code: 'CUP' }, { kind: 'delete', replacement: 'BWL' }, cup);
    const moved = SpecId.restoreCode(code);
    expect(moved.slot('productType')).toBe('BWL');
    // Whatever BWL rules, every ruled field now fits it: reading the code with `next` passed.
    expect(SpecId.parse(code, next).ok).toBe(true);
  });

  it('leaves a Spec ID the change does not touch as it was', () => {
    const lid = built(LID);
    expect(approve({ slot: 'material', code: 'APP' }, { kind: 'edit', newCode: 'APQ', meaning: null, searchWords: null }, lid).code).toBe(lid.code);
  });
});

describe('rewritesSpecIds', () => {
  it('is true for a new code, a deletion or a rules change, and false for an add or a new wording', () => {
    expect(rewritesSpecIds({ kind: 'edit', newCode: 'APZ', meaning: null, searchWords: null })).toBe(true);
    expect(rewritesSpecIds({ kind: 'delete', replacement: null })).toBe(true);
    expect(rewritesSpecIds({ kind: 'rules', rules: { coating: 'never' } })).toBe(true);
    expect(rewritesSpecIds({ kind: 'edit', newCode: null, meaning: 'x', searchWords: null })).toBe(false);
    expect(rewritesSpecIds({ kind: 'add', meaning: 'x', searchWords: [], rules: null })).toBe(false);
  });
});
