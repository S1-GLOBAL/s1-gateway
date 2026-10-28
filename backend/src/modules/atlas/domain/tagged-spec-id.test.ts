import { describe, expect, it } from 'vitest';
import type { Result } from '../../../shared/domain/result.js';
import { V2_LETTERS } from './tagged-spec-id-v2.js';
import { TaggedSpecId, TaggedSpecIdError, TAGGED_SPEC_ID_TAGS, SlotNumbering, describeTagged, taggedDictionary, watchTagged } from './tagged-spec-id.js';
import { slotDefinition } from './slots.js';
import type { SpecIdFactsInput } from './spec-id.js';
import { Dictionary } from './dictionary.js';
import { COMBINED_PRODUCT_TYPES, combinedProductRules } from './tagged-combined-products.js';
import { S2_0_1_0_RULES, S2_0_1_0_VALUES, s2Dictionary } from './testing/s2-dictionary.js';
import { ILLUSTRATIVE } from './testing/spec-id-codes.js';

const issued = s2Dictionary();
const taggedValues = [...S2_0_1_0_VALUES, ...COMBINED_PRODUCT_TYPES];
const dictionary = new Dictionary(issued.release, issued.approvedOn, taggedValues, [...S2_0_1_0_RULES, ...combinedProductRules(issued)]);
const numbering = SlotNumbering.fromIssuance(taggedValues);

/** The cup from ADR 0025, still in the 25-part spelling. */
const CUP = 'CUP.BCS.Y.WH.RD.X.Z0012.0090.Y.0110.X.X.X.Y.Y.Y.DW.02.X.X.X.X.X.X.X';

const CUP_SUMMARY = 'Cup, Paper and paperboard, cup stock, White, Round, 12 oz, 90 mm, 110 mm, Double wall, 2 colours';

function read(code: string): TaggedSpecId {
  const result = TaggedSpecId.read(code, dictionary, numbering);
  if (!result.ok) throw new Error(`expected ${code} to read: ${result.error.problems.join(' | ')}`);
  return result.value;
}

function problemsOf(code: string): readonly string[] {
  return rejection(TaggedSpecId.read(code, dictionary, numbering), code);
}

function rejection<T>(result: Result<T, TaggedSpecIdError>, label: string): readonly string[] {
  if (result.ok) throw new Error(`expected ${label} to be refused`);
  expect(result.error).toBeInstanceOf(TaggedSpecIdError);
  expect(result.error.code).toBe('INVALID_TAGGED_SPEC_ID');
  return result.error.problems;
}

/** The parts of a body, last first, so the test can paste a code out of order. */
function reversed(body: string): string {
  const parts: string[] = [];
  let index = 0;
    while (index < body.length) {
    if (body.charAt(index) === '-') {
      index += 1;
      continue;
    }
    let letterEnd = index;
    while (letterEnd < body.length && body.charAt(letterEnd) >= 'A' && body.charAt(letterEnd) <= 'Z') letterEnd += 1;
    let digitEnd = letterEnd;
    while (digitEnd < body.length && body.charAt(digitEnd) >= '0' && body.charAt(digitEnd) <= '9') digitEnd += 1;
    parts.push(body.slice(index, digitEnd));
    index = digitEnd;
  }
  return parts.reverse().join('');
}

describe('tagged Spec ID', () => {
  it('writes only the known facts, in slot order', () => {
    const cup = read(CUP);
    expect(cup.body).toBe('PT5M17CL3SH1WL2PR3-Z12TD90H110');
    expect(cup.code).toBe(cup.body);
    expect(cup.body.includes('X')).toBe(false);
    expect(cup.body.includes('Y')).toBe(false);
    expect(cup.summary(dictionary)).toBe(CUP_SUMMARY);
    expect(CUP.length).toBe(67);
    expect(cup.code.length).toBeLessThan(CUP.length);
  });

  it('reads any order, any case, and stores one spelling', () => {
    const cup = read(CUP);
    const shuffled = read(reversed(cup.body).toLowerCase());
    expect(shuffled.code).toBe(cup.code);
    expect(shuffled.summary(dictionary)).toBe(CUP_SUMMARY);
    expect(read(cup.code).code).toBe(cup.code);
  });

  it('reads the illustrative bowl lid the same way', () => {
    const lid = read(ILLUSTRATIVE);
    expect(lid.body).toBe('PT1M4CL1SH1PF1-TD90UW33');
    expect(lid.summary(dictionary)).toBe('Bowl lid, Polymer, PS (polystyrene), Clear, Round, Dome, 90 mm, 3.3 g');
    expect(read(lid.code).code).toBe(lid.code);
  });

  it('leaves out a fact that was not given', () => {
    const built = TaggedSpecId.build({ productType: 'CUP', material: 'BCS', capacity: { unit: 'Z', value: '12' } }, dictionary, numbering);
    if (!built.ok) throw new Error(built.error.problems.join(' | '));
    expect(built.value.body).toBe('PT5M17-Z12');
    expect(built.value.summary(dictionary)).toBe('Cup, Paper and paperboard, cup stock, 12 oz');
    expect(read(built.value.code).code).toBe(built.value.code);
  });

  it('refuses a tag with no value and names the tag', () => {
    expect(problemsOf('M4PTCL1')).toEqual([
      'Product type (PT) has no value. Write a number after PT, for example PT1.',
    ]);
  });

  it('refuses a code with no product type', () => {
    expect(problemsOf('M17CL3')).toEqual([
      'Product type (PT) is missing. Every code includes it, for example PT1.',
    ]);
  });

  it('refuses a slot the product does not have', () => {
    expect(problemsOf('PT16M6TD90')).toEqual(["Top diameter doesn't apply to a bag. Leave it out."]);
    expect(problemsOf('PT5PF1')).toEqual(["Profile doesn't apply to a cup. Leave it out."]);
  });

  it('refuses a diameter while the shape is left out', () => {
    expect(problemsOf('PT5TD90')).toEqual([
      "Top diameter can't be set while the shape is not known. Add the shape, or leave top diameter out.",
    ]);
  });

  it('refuses a number the dictionary does not have', () => {
    expect(problemsOf('PT5M99CL3')).toEqual(['Material: 99 is not in the dictionary.']);
  });

  it('refuses the same slot twice', () => {
    expect(problemsOf('PT5PT6')).toEqual(['Product type is given twice.']);
  });

  it('reads a product type on its own', () => {
    expect(read('PT5').code).toBe('PT5');
    expect(read('PT5').summary(dictionary)).toBe('Cup');
  });

  it('reads millilitres as ML, so M stays material', () => {
    const facts: SpecIdFactsInput = { productType: 'CUP', capacity: { unit: 'M', value: '500' } };
    const built = TaggedSpecId.build(facts, dictionary, numbering);
    if (!built.ok) throw new Error(built.error.problems.join(' | '));
    expect(built.value.body).toBe('PT5-ML500');
    expect(built.value.summary(dictionary)).toBe('Cup, 500 mL');
    expect(problemsOf('PT5MML500')).toEqual([
      'Material (M) has no value. Write a number after M, for example M1.',
    ]);
  });

  it('uses letters, numbers and one hyphen', () => {
    expect(problemsOf('PT5 M17')).toEqual(['A Spec ID uses letters, numbers and one hyphen.']);
    expect(problemsOf('PT5-M17-Z12')).toEqual(['A Spec ID has one hyphen, before the sizes.']);
  });

  it('rewrites the whole dictionary in issuance order', () => {
    const groups = taggedDictionary(S2_0_1_0_VALUES, numbering);
    const productTypes = groups.find((group) => group.title === 'Product type');
    const materials = groups.find((group) => group.title === 'Material');
    const colours = groups.find((group) => group.title === 'Colour / clarity');
    expect(productTypes?.entries[0]).toEqual({ code: 'PT1', meaning: 'Bowl lid', former: 'BLD' });
    expect(productTypes?.entries[4]).toEqual({ code: 'PT5', meaning: 'Cup', former: 'CUP' });
    expect(productTypes?.entries).toHaveLength(31);
    expect(materials?.entries[16]).toEqual({ code: 'M17', meaning: 'Paper and paperboard, cup stock', former: 'BCS' });
    expect(colours?.entries[2]).toEqual({ code: 'CL3', meaning: 'White', former: 'WH' });
    expect(groups.find((group) => group.title === 'Sizes')?.entries.map((entry) => entry.code)).toEqual([
      'TD', 'BD', 'H', 'LN', 'W', 'GS', 'UW', 'BW', 'TH',
    ]);
    expect(groups.find((group) => group.title === 'Nominal capacity')?.entries.map((entry) => entry.code)).toEqual([
      'Z', 'ML', 'SV', 'PC', 'GR',
    ]);
  });

  it('warns as a v2 code is typed, and leaves the text alone', () => {
    const bowl = watchTagged('A1', dictionary, numbering, 'v2');
    expect(bowl.warnings).toEqual([]);
    expect(bowl.facts).toEqual([{ name: 'Product type', meaning: 'Bowl lid' }]);

    const capacity = watchTagged('A1G', dictionary, numbering, 'v2');
    expect(capacity.warnings).toEqual(['Nominal capacity: This part is not applicable for a bowl lid.']);
    expect(capacity.facts).toEqual([{ name: 'Product type', meaning: 'Bowl lid' }]);

    const unknown = watchTagged('A1GY', dictionary, numbering, 'v2');
    expect(unknown.warnings).toEqual([
      'Nominal capacity: This part is not applicable for a bowl lid.',
      'Y: This key/part is unknown.',
    ]);

    const missing = watchTagged('A99', dictionary, numbering, 'v2');
    expect(missing.warnings).toEqual(['A99: This key/part is unknown.']);

    const square = watchTagged('A5E2H', dictionary, numbering, 'v2');
    expect(square.warnings).toEqual(['Top diameter: This part is not applicable for a cup.']);

    const paper = watchTagged('A5B1O', dictionary, numbering, 'v2');
    expect(paper.warnings).toEqual(['Basis weight: This part is not applicable for a cup.']);

    const stock = watchTagged('A5B17O', dictionary, numbering, 'v2');
    expect(stock.warnings).toEqual([]);
  });

  it('turns a product description into a v2 code, and leaves a range out', () => {
    const cup = describeTagged('22oz White Single Wall Paper Cold Cup (2-3 color print)', dictionary, numbering);
    expect(cup.facts).toEqual([
      { name: 'Product type', meaning: 'Cup' },
      { name: 'Material', meaning: 'Paper and paperboard, grade not known' },
      { name: 'Colour / clarity', meaning: 'White' },
      { name: 'Nominal capacity', meaning: '22 oz' },
      { name: 'Wall', meaning: 'Single wall' },
    ]);
    expect(cup.warnings).toEqual(['Print was given as 2 colour and 3 colour, so it was left out.']);
    expect(cup.ignored).toEqual(['Cold']);
    expect(cup.code).not.toBeNull();
    const again = TaggedSpecId.read(cup.code ?? '', dictionary, numbering, 'v2');
    expect(again.ok).toBe(true);
    if (!again.ok || cup.code === null) return;
    expect(again.value.body).toBe('A5B24D3Q1-G122');
    expect(again.value.code).toBe(cup.code);
  });

  it('suggests the dictionary entry or the missing number for words it could not use', () => {
    const bag = describeTagged('HDPE T-shirt Bag with Printing on Gusset', dictionary, numbering);
    expect(bag.facts.map((fact) => fact.meaning)).toEqual(['Bag', 'T-shirt (vest)']);
    expect(bag.warnings).toEqual([
      "HDPE isn't listed on its own. It matches Polymer, HDPE, B6.",
      'Printing is mentioned, but not which one. No print is R1. 1 colour is R2. 2 colours is R3. 3 colours is R4. 4 colours is R5. 5 colours is R6. 6 colours is R7. 7 colours is R8. 8 colours is R9. Full colour is R10.',
      'Gusset is mentioned, but no width in millimetres. The range is 1–9999 mm. 40 mm is M40.',
    ]);
    expect(bag.ignored).toEqual(['with', 'on']);
    const again = TaggedSpecId.read(bag.code ?? '', dictionary, numbering, 'v2');
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.value.body).toBe('A16V4');
  });

  it('reads a size written beside the part it measures', () => {
    const bag = describeTagged('HDPE T-shirt Bag with Printing on 40mm gusset', dictionary, numbering);
    expect(bag.facts).toEqual([
      { name: 'Product type', meaning: 'Bag' },
      { name: 'Gusset', meaning: '40 mm' },
      { name: 'Handle', meaning: 'T-shirt (vest)' },
    ]);
    expect(bag.warnings.some((warning) => warning.includes('no width'))).toBe(false);
    expect(bag.ignored).toEqual(['with', 'on']);
    const again = TaggedSpecId.read(bag.code ?? '', dictionary, numbering, 'v2');
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.value.body).toBe('A16V4-M40');

    const sizes = describeTagged(
      'Bag 110mm height, width of 200 mm, gusset 40mm, unit weight 3.3g and thickness 350um',
      dictionary,
      numbering,
    );
    expect(sizes.facts).toEqual([
      { name: 'Product type', meaning: 'Bag' },
      { name: 'Height', meaning: '110 mm' },
      { name: 'Width', meaning: '200 mm' },
      { name: 'Gusset', meaning: '40 mm' },
      { name: 'Unit weight', meaning: '3.3 g' },
      { name: 'Thickness', meaning: '350 µm' },
    ]);
    const sized = TaggedSpecId.read(sizes.code ?? '', dictionary, numbering, 'v2');
    expect(sized.ok).toBe(true);
    if (!sized.ok) return;
    expect(sized.value.body).toBe('A16-J110L200M40N33P350');

    const paper = describeTagged('Paper bag basis weight 280gsm', dictionary, numbering);
    expect(paper.facts.map((fact) => fact.meaning)).toContain('280 gsm');

    const round = describeTagged('Round cup 90mm top diameter, bottom diameter 70mm, height of 110 mm', dictionary, numbering);
    expect(round.facts).toEqual([
      { name: 'Product type', meaning: 'Cup' },
      { name: 'Shape', meaning: 'Round' },
      { name: 'Top diameter', meaning: '90 mm' },
      { name: 'Bottom diameter', meaning: '70 mm' },
      { name: 'Height', meaning: '110 mm' },
    ]);

    const refused = describeTagged('Cup with 40mm gusset', dictionary, numbering);
    expect(refused.facts.map((fact) => fact.meaning)).toEqual(['Cup']);
    expect(refused.warnings).toContain('Gusset does not apply to a cup.');
    expect(refused.ignored).not.toContain('40mm');

    const centimetres = describeTagged('Bag with 40cm gusset', dictionary, numbering);
    expect(centimetres.facts.map((fact) => fact.meaning)).toContain('400 mm (converted from 40 cm)');
    expect(centimetres.warnings.some((warning) => warning.includes('no width'))).toBe(false);

    const inches = describeTagged('HDPE T-shirt Bag with Printing on Gusset 40inch', dictionary, numbering);
    expect(inches.facts.map((fact) => fact.meaning)).toContain('1016 mm (converted from 40 inch)');
    expect(inches.ignored).not.toContain('40inch');
    const inchCode = TaggedSpecId.read(inches.code ?? '', dictionary, numbering, 'v2');
    expect(inchCode.ok).toBe(true);
    if (inchCode.ok) expect(inchCode.value.body).toContain('M1016');

    const thick = describeTagged('Bag thickness 0.35mm', dictionary, numbering);
    expect(thick.facts.map((fact) => fact.meaning)).toContain('350 µm (converted from 0.35 mm)');
    const heavy = describeTagged('Bag unit weight 0.33kg', dictionary, numbering);
    expect(heavy.facts.map((fact) => fact.meaning)).toContain('330 g (converted from 0.33 kg)');

    const counted = describeTagged('Tray compartments 3', dictionary, numbering);
    expect(counted.facts.map((fact) => fact.meaning)).toEqual(['Tray', '3 compartments']);
    const plies = describeTagged('Napkin 2 plies', dictionary, numbering);
    expect(plies.facts.map((fact) => fact.meaning)).toContain('2 plies');
    const servings = describeTagged('Cup 12 servings', dictionary, numbering);
    expect(servings.facts.map((fact) => fact.meaning)).toContain('12 servings');
    const grams = describeTagged('Bag 3.3g', dictionary, numbering);
    expect(grams.facts.map((fact) => fact.meaning)).toContain('3.3 g');
    const gsm = describeTagged('Paper bag 280 gsm', dictionary, numbering);
    expect(gsm.facts.map((fact) => fact.meaning)).toContain('280 gsm');
  });

  it('reads every issued name that belongs to one value', () => {
    const host: Readonly<Record<string, string>> = {
      material: 'bag',
      coating: 'bag',
      colourClarity: 'bag',
      shape: 'cup',
      profile: 'cup lid',
      wall: 'cup',
      print: 'bag',
      lidOpening: 'cup lid',
      handle: 'bag',
      wrap: 'napkin',
      window: 'bag',
    };
    const values = dictionary.values().filter((value) => value.slot !== 'capacity');
    const wordsOf = (meaning: string) => meaning.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 0);
    for (const value of values) {
      const words = wordsOf(value.meaning);
      const sharedWord = words.length === 1 && values.some((other) => (other.slot !== value.slot || other.code !== value.code) && wordsOf(other.meaning).includes(words[0] ?? ''));
      if (value.slot !== 'productType' && (sharedWord || host[value.slot] === undefined)) continue;
      const sentence = value.slot === 'productType' ? value.meaning : `${value.meaning} ${host[value.slot] ?? ''}`;
      const described = describeTagged(sentence, dictionary, numbering);
      expect(described.facts.map((fact) => fact.meaning), sentence).toContain(value.meaning);
    }
  });

  it('reads adjacent words as the one entry they name together', () => {
    const bag = describeTagged('Polymer HDPE T-shirt Bag with Printing on Gusset', dictionary, numbering);
    expect(bag.facts.map((fact) => fact.meaning)).toEqual(['Bag', 'Polymer, HDPE', 'T-shirt (vest)']);
    expect(bag.warnings.some((warning) => warning.startsWith('Polymer matches'))).toBe(false);
    expect(bag.warnings.some((warning) => warning.includes("HDPE isn't listed"))).toBe(false);
    expect(bag.warnings.some((warning) => warning.startsWith('Printing is mentioned'))).toBe(true);
    const again = TaggedSpecId.read(bag.code ?? '', dictionary, numbering, 'v2');
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.value.body).toBe('A16B6V4');

    const reversed = describeTagged('HDPE Polymer bag', dictionary, numbering);
    expect(reversed.facts.map((fact) => fact.meaning)).toContain('Polymer, HDPE');
  });

  it('reads every dictionary name from the words in it, not only HDPE', () => {
    for (const value of dictionary.valuesOf('material')) {
      if (!value.meaning.startsWith('Polymer,')) continue;
      const described = describeTagged(`${value.meaning} bag`, dictionary, numbering);
      expect(described.facts.map((fact) => fact.meaning), value.meaning).toContain(value.meaning);
      expect(described.warnings.some((warning) => warning.startsWith('Polymer matches')), value.meaning).toBe(false);
    }

    const handle = describeTagged('flat tape bag', dictionary, numbering);
    expect(handle.facts.map((fact) => fact.meaning)).toContain('Flat tape');

    const laminate = describeTagged('Laminate paper polymer bag', dictionary, numbering);
    expect(laminate.facts.map((fact) => fact.meaning)).toContain('Laminate, paper / polymer');
    expect(laminate.facts.map((fact) => fact.meaning)).not.toContain('Paper and paperboard, grade not known');
  });

  it('lists every value of a named slot, and says when that slot does not apply', () => {
    const handle = describeTagged('Bag, handle', dictionary, numbering);
    expect(handle.warnings).toContain(
      'handle is mentioned, but not which one. No handle is V1. Twisted paper is V2. Flat tape is V3. T-shirt (vest) is V4.',
    );

    const refused = describeTagged('Cup with Gusset', dictionary, numbering);
    expect(refused.warnings).toContain('Gusset does not apply to a cup.');

    const tray = describeTagged('Tray with compartment', dictionary, numbering);
    expect(tray.warnings).toContain('compartment is mentioned, but no count, from 1 to 12. 3 compartments is S3.');
  });

  it('lists every material a family word matches, and the closest spelling', () => {
    const bowl = describeTagged('Polymer bowl', dictionary, numbering);
    const line = bowl.warnings.find((warning) => warning.startsWith('Polymer matches'));
    expect(line).toBeDefined();
    for (const value of dictionary.valuesOf('material')) {
      if (!value.meaning.startsWith('Polymer,')) continue;
      expect(line).toContain(value.meaning);
    }

    const misspelled = describeTagged('HDEP T-shirt Bag', dictionary, numbering);
    expect(misspelled.warnings).toContain("HDEP isn't listed on its own. It matches Polymer, HDPE, B6.");

    const listed = describeTagged('5 oz Cold Paper Cup (listed size 6oz)', dictionary, numbering);
    expect(listed.warnings.some((warning) => warning.toLowerCase().includes('size'))).toBe(false);
    expect(listed.code).toBe('A5B24');
  });

  it('reads a vessel supplied with its lid as the combined product', () => {
    const cup = describeTagged('12oz PET Cups (2c Print) w/ Lids', dictionary, numbering);
    expect(cup.facts.map((fact) => fact.meaning)).toEqual(['Cup with Cup Lid', 'Polymer, PET', '12 oz']);
    expect(cup.warnings.some((warning) => warning.startsWith('Product type:'))).toBe(false);
    expect(cup.ignored).toEqual(['2c']);
    expect(cup.code).toBe('A33B1-G112');

    expect(describeTagged('Bowl with Bowl Lid', dictionary, numbering).facts.map((fact) => fact.meaning)).toEqual(['Bowl with Bowl Lid']);
    expect(describeTagged('Portion cup with lid', dictionary, numbering).facts.map((fact) => fact.meaning)).toContain('Portion cup with Portion cup lid');
    expect(describeTagged('Container with lid', dictionary, numbering).facts.map((fact) => fact.meaning)).toEqual(['Container with lid']);

    const bare = describeTagged('12oz PET Cups Lids', dictionary, numbering);
    expect(bare.warnings[0]).toBe('Product type: Cups is Cup (A5). Lids is Cup lid (A2). Both were left out.');
    expect(bare.code).toBeNull();
  });

  it('stores a decimal capacity with the point in the code', () => {
    const cup = describeTagged('3.25 oz Portion Cup', dictionary, numbering);
    expect(cup.code).toBe('A6-G13.25');
    expect(cup.facts.map((fact) => fact.meaning)).toEqual(['Portion cup', '3.25 oz']);
    expect(cup.warnings.some((warning) => warning.includes('whole number'))).toBe(false);

    const whole = describeTagged('12 oz Portion Cup', dictionary, numbering);
    expect(whole.code).toBe('A6-G112');
    expect(whole.facts.map((fact) => fact.meaning)).toEqual(['Portion cup', '12 oz']);

    const again = TaggedSpecId.read('A6-G13.25', dictionary, numbering, 'v2');
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.value.code).toBe('A6-G13.25');
    expect(again.value.summary(dictionary)).toBe('Portion cup, 3.25 oz');

    const large = TaggedSpecId.read('A6-G1325', dictionary, numbering, 'v2');
    expect(large.ok).toBe(true);
    if (!large.ok) return;
    expect(large.value.summary(dictionary)).toBe('Portion cup, 325 oz');

    const lid = describeTagged('PET Clear lid for 3.25 oz Souffle Cup', dictionary, numbering);
    expect(lid.code).toBe('A7B1D1');
    expect(lid.facts.map((fact) => fact.meaning)).not.toContain('3.25 oz');
  });

  it('reads a hinged container as the clamshell, with its three sizes', () => {
    const box = describeTagged('9 x 6 x 3.25inches, PP Hinged Container Clear', dictionary, numbering);
    expect(box.code).toBe('A11B3D1E3-J83K229L152');
    expect(box.facts).toEqual([
      { name: 'Product type', meaning: 'Hinged container (clamshell)' },
      { name: 'Material', meaning: 'Polymer, PP' },
      { name: 'Colour / clarity', meaning: 'Clear' },
      { name: 'Shape', meaning: 'Rectangular' },
      { name: 'Height', meaning: '83 mm (converted from 3.25 inch)' },
      { name: 'Length', meaning: '229 mm (converted from 9 inch)' },
      { name: 'Width', meaning: '152 mm (converted from 6 inch)' },
    ]);
    expect(box.warnings.some((warning) => warning.startsWith('Hinged'))).toBe(false);
    expect(box.ignored).toEqual([]);
    expect(describeTagged('hinged container', dictionary, numbering).facts.map((fact) => fact.meaning)).toEqual(['Hinged container (clamshell)']);
  });

  it('reads a lid for a souffle cup as the portion cup lid', () => {
    const lid = describeTagged('PET Clear lid for 2 oz Souffle Cup', dictionary, numbering);
    expect(lid.code).toBe('A7B1D1');
    expect(lid.facts.map((fact) => fact.meaning)).toEqual(['Portion cup lid', 'Polymer, PET', 'Clear']);
    expect(lid.warnings[0]).toBe('The product is the lid. It goes on a 2 oz Souffle Cup. It is a Portion cup lid (A7).');
    expect(lid.warnings).toContain('Nominal capacity does not apply to a portion cup lid.');
    expect(lid.warnings.some((warning) => warning.includes('was left out'))).toBe(false);
    expect(lid.warnings.some((warning) => warning.startsWith('Product type:'))).toBe(false);
    expect(lid.ignored).toEqual([]);

    expect(describeTagged('lid for bowl', dictionary, numbering).facts.map((fact) => fact.meaning)).toEqual(['Bowl lid']);
    const cupLid = describeTagged('lid for 8 oz cup', dictionary, numbering);
    expect(cupLid.code).toBe('A2');
    expect(cupLid.facts.map((fact) => fact.meaning)).toEqual(['Cup lid']);
    expect(describeTagged('Portion cup lid', dictionary, numbering).facts.map((fact) => fact.meaning)).toEqual(['Portion cup lid']);
  });

  it('names both materials when PET and Plastic are written together', () => {
    const cup = describeTagged('12 oz PET Plastic Cold Cup with 2 color print', dictionary, numbering);
    expect(cup.warnings).toContain('Material: PET is Polymer, PET (B1). Plastic is Polymer, grade not known (B11). Both were left out.');
    expect(cup.facts.map((fact) => fact.name)).toContain('Product type');
    expect(cup.facts.map((fact) => fact.name)).not.toContain('Material');
  });

  it('converts a box written in inches into millimetres', () => {
    const box = describeTagged('Box 20-1/8 x 13 x 10', dictionary, numbering);
    expect(box.facts).toEqual([
      { name: 'Product type', meaning: 'Folding carton' },
      { name: 'Height', meaning: '254 mm (converted from 10 inch)' },
      { name: 'Length', meaning: '511 mm (converted from 20.125 inch)' },
      { name: 'Width', meaning: '330 mm (converted from 13 inch)' },
    ]);
  });

  it('writes v2 as one letter per slot, in the same order', () => {
    expect(V2_LETTERS.map((entry) => entry.letter).join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVWX');
    expect(V2_LETTERS.map((entry) => entry.name)).toEqual(V2_LETTERS.map((entry) => slotDefinition(entry.slot).name));
    const result = TaggedSpecId.read(CUP, dictionary, numbering, 'v2');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.body).toBe('A5B17D3E1Q2R3-G112H90J110');
    expect(result.value.summary(dictionary)).toBe(CUP_SUMMARY);
    const again = TaggedSpecId.read(result.value.code, dictionary, numbering, 'v2');
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.value.code).toBe(result.value.code);
    const groups = taggedDictionary(S2_0_1_0_VALUES, numbering, 'v2');
    expect(groups.find((group) => group.title === 'Product type')?.entries[0]?.code).toBe('A1');
    expect(groups.find((group) => group.title === 'Material')?.entries[0]?.code).toBe('B1');
    expect(groups.find((group) => group.title === 'Coating')?.entries[0]?.code).toBe('C1');
    expect(groups.find((group) => group.title === 'Colour / clarity')?.entries[0]?.code).toBe('D1');
    expect(groups.find((group) => group.title === 'Nominal capacity')?.entries.map((entry) => entry.code)).toEqual([
      'G1', 'G2', 'G3', 'G4', 'G5',
    ]);
    const sizes = groups.find((group) => group.title === 'Sizes')?.entries;
    expect(sizes?.map((entry) => entry.code)).toEqual(['H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P']);
    expect(sizes?.find((entry) => entry.code === 'N')?.meaning).toBe('Unit weight, in tenths of a gram. 3.3 g is N33');
    expect(sizes?.find((entry) => entry.code === 'P')?.meaning).toBe('Thickness, in micrometres. 350 µm is P350');
  });

  it('stores diameters, height, length, width and gusset in millimetres only', () => {
    const inch = TaggedSpecId.build(
      { productType: 'CUP', shape: 'RD', topDiameter: { value: '1', unit: 'in' } },
      dictionary,
      numbering,
      'v2',
    );
    expect(inch.ok).toBe(false);
    if (inch.ok) return;
    expect(inch.error.problems).toEqual(['Top diameter is in millimetres. 1 in was not stored.']);

    const centimetres = TaggedSpecId.build(
      { productType: 'CUP', shape: 'RD', height: { value: '9', unit: 'cm' } },
      dictionary,
      numbering,
      'v2',
    );
    expect(centimetres.ok).toBe(false);
    if (centimetres.ok) return;
    expect(centimetres.error.problems).toEqual(['Height is in millimetres. 9 cm was not stored.']);

    const millimetres = TaggedSpecId.build(
      { productType: 'CUP', shape: 'RD', topDiameter: { value: '90', unit: 'mm' }, height: { value: '110', unit: 'mm' } },
      dictionary,
      numbering,
      'v2',
    );
    expect(millimetres.ok).toBe(true);
    if (!millimetres.ok) return;
    expect(millimetres.value.body).toContain('H90');
    expect(millimetres.value.body).toContain('J110');
  });

  it('has no tag that is two other tags joined', () => {
    const tags = new Set(TAGGED_SPEC_ID_TAGS);
    const joined: string[] = [];
    for (const left of tags) {
      for (const right of tags) {
        const together = left + right;
        if (tags.has(together)) joined.push(together);
      }
    }
    expect(joined).toEqual([]);
    expect(tags.has('M')).toBe(true);
    expect(tags.has('ML')).toBe(true);
  });
});
