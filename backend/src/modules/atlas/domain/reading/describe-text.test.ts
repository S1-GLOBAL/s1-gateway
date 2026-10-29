import { describe, expect, it } from 'vitest';
import { s2Dictionary } from '../testing/s2-dictionary.js';
import { describeText, factsInWords } from './describe-text.js';

const dictionary = s2Dictionary();

/** What the page shows for `text`: the code, each fact in words, the notes, and the words nothing used. */
function described(text: string) {
  const description = describeText(text, dictionary);
  return {
    code: description.specId?.code ?? null,
    facts: factsInWords(description, dictionary).map(({ name, meaning }) => ({ name, meaning })),
    notes: description.notes,
    ignored: description.ignored,
  };
}

const meanings = (text: string) => described(text).facts.map((fact) => fact.meaning);

describe('reading a product description (plan 0011)', () => {
  it('keeps the facts its product has, and leaves a range out', () => {
    const cup = described('22oz White Single Wall Paper Cold Cup (2-3 color print)');
    expect(cup.facts).toEqual([
      { name: 'Product type', meaning: 'Cup' },
      { name: 'Material', meaning: 'Paper and paperboard, grade not known' },
      { name: 'Colour / clarity', meaning: 'White' },
      { name: 'Nominal capacity', meaning: '22 oz' },
      { name: 'Wall', meaning: 'Single wall' },
    ]);
    expect(cup.notes).toEqual(['Print was given as 2 colour and 3 colour, so it was left out.']);
    expect(cup.ignored).toEqual(['Cold']);
    expect(cup.code).toBe('A5B24D3Q1-G122');
  });

  it('suggests the dictionary entry or the missing number for words it could not use', () => {
    const bag = described('HDPE T-shirt Bag with Printing on Gusset');
    expect(bag.facts.map((fact) => fact.meaning)).toEqual(['Bag', 'T-shirt (vest)']);
    expect(bag.notes).toEqual([
      "HDPE isn't listed on its own. It matches Polymer, HDPE, B6.",
      'Printing is mentioned, but not which one. No print is R1. 1 colour is R2. 2 colours is R3. 3 colours is R4. 4 colours is R5. 5 colours is R6. 6 colours is R7. 7 colours is R8. 8 colours is R9. Full colour is R10.',
      'Gusset is mentioned, but no width in millimetres. The range is 1–9999 mm. 40 mm is M40.',
    ]);
    expect(bag.ignored).toEqual(['with', 'on']);
    expect(bag.code).toBe('A16V4');
  });

  it('reads a size written beside the part it measures', () => {
    const bag = described('HDPE T-shirt Bag with Printing on 40mm gusset');
    expect(bag.facts).toEqual([
      { name: 'Product type', meaning: 'Bag' },
      { name: 'Gusset', meaning: '40 mm' },
      { name: 'Handle', meaning: 'T-shirt (vest)' },
    ]);
    expect(bag.notes.some((note) => note.includes('no width'))).toBe(false);
    expect(bag.code).toBe('A16V4-M40');

    const sizes = described('Bag 110mm height, width of 200 mm, gusset 40mm, unit weight 3.3g and thickness 350um');
    expect(sizes.facts.map((fact) => fact.meaning)).toEqual(['Bag', '110 mm', '200 mm', '40 mm', '3.3 g', '350 µm']);
    expect(sizes.code).toBe('A16-J110L200M40N33P350');

    expect(meanings('Paper bag basis weight 280gsm')).toContain('280 gsm');
    expect(meanings('Round cup 90mm top diameter, bottom diameter 70mm, height of 110 mm')).toEqual([
      'Cup',
      'Round',
      '90 mm',
      '70 mm',
      '110 mm',
    ]);

    const refused = described('Cup with 40mm gusset');
    expect(refused.facts.map((fact) => fact.meaning)).toEqual(['Cup']);
    expect(refused.notes).toContain('Gusset does not apply to a cup.');
    expect(refused.ignored).not.toContain('40mm');

    expect(meanings('Tray compartments 3')).toEqual(['Tray', '3 compartments']);
    expect(meanings('Napkin 2 plies')).toContain('2 plies');
    expect(meanings('Cup 12 servings')).toContain('12 servings');
    expect(meanings('Bag 3.3g')).toContain('3.3 g');
    expect(meanings('Paper bag 280 gsm')).toContain('280 gsm');
  });

  it('converts a size into the unit its slot stores, and says so', () => {
    expect(meanings('Bag with 40cm gusset')).toContain('400 mm (converted from 40 cm)');
    const inches = described('HDPE T-shirt Bag with Printing on Gusset 40inch');
    expect(inches.facts.map((fact) => fact.meaning)).toContain('1016 mm (converted from 40 inch)');
    expect(inches.code).toContain('M1016');
    expect(meanings('Bag thickness 0.35mm')).toContain('350 µm (converted from 0.35 mm)');
    expect(meanings('Bag unit weight 0.33kg')).toContain('330 g (converted from 0.33 kg)');
    expect(described('Box 20-1/8 x 13 x 10').facts).toEqual([
      { name: 'Product type', meaning: 'Folding carton' },
      { name: 'Height', meaning: '254 mm (converted from 10 inch)' },
      { name: 'Length', meaning: '511 mm (converted from 20.125 inch)' },
      { name: 'Width', meaning: '330 mm (converted from 13 inch)' },
    ]);
  });

  it('reads a hinged container as the clamshell, with its three sizes', () => {
    const box = described('9 x 6 x 3.25inches, PP Hinged Container Clear');
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
    expect(box.ignored).toEqual([]);
    expect(meanings('hinged container')).toEqual(['Hinged container (clamshell)']);
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
    const wordsOf = (meaning: string) =>
      meaning
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length > 0);
    for (const value of values) {
      const words = wordsOf(value.meaning);
      const sharedWord =
        words.length === 1 &&
        values.some(
          (other) => (other.slot !== value.slot || other.code !== value.code) && wordsOf(other.meaning).includes(words[0] ?? ''),
        );
      if (value.slot !== 'productType' && (sharedWord || host[value.slot] === undefined)) continue;
      const sentence = value.slot === 'productType' ? value.meaning : `${value.meaning} ${host[value.slot] ?? ''}`;
      expect(meanings(sentence), sentence).toContain(value.meaning);
    }
  });

  it('reads adjacent words as the one entry they name together', () => {
    const bag = described('Polymer HDPE T-shirt Bag with Printing on Gusset');
    expect(bag.facts.map((fact) => fact.meaning)).toEqual(['Bag', 'Polymer, HDPE', 'T-shirt (vest)']);
    expect(bag.notes.some((note) => note.startsWith('Polymer matches'))).toBe(false);
    expect(bag.notes.some((note) => note.includes("HDPE isn't listed"))).toBe(false);
    expect(bag.notes.some((note) => note.startsWith('Printing is mentioned'))).toBe(true);
    expect(bag.code).toBe('A16B6V4');
    expect(meanings('HDPE Polymer bag')).toContain('Polymer, HDPE');

    for (const value of dictionary.valuesOf('material')) {
      if (!value.meaning.startsWith('Polymer,')) continue;
      const polymer = described(`${value.meaning} bag`);
      expect(polymer.facts.map((fact) => fact.meaning), value.meaning).toContain(value.meaning);
      expect(polymer.notes.some((note) => note.startsWith('Polymer matches')), value.meaning).toBe(false);
    }
    expect(meanings('flat tape bag')).toContain('Flat tape');
    const laminate = meanings('Laminate paper polymer bag');
    expect(laminate).toContain('Laminate, paper / polymer');
    expect(laminate).not.toContain('Paper and paperboard, grade not known');
  });

  it('lists every value of a named slot, and says when that slot does not apply', () => {
    expect(described('Bag, handle').notes).toContain(
      'handle is mentioned, but not which one. No handle is V1. Twisted paper is V2. Flat tape is V3. T-shirt (vest) is V4.',
    );
    expect(described('Cup with Gusset').notes).toContain('Gusset does not apply to a cup.');
    expect(described('Tray with compartment').notes).toContain('compartment is mentioned, but no count, from 1 to 12. 3 compartments is S3.');
  });

  it('lists every material a family word matches, and the closest spelling', () => {
    const line = described('Polymer bowl').notes.find((note) => note.startsWith('Polymer matches'));
    expect(line).toBeDefined();
    for (const value of dictionary.valuesOf('material')) {
      if (value.meaning.startsWith('Polymer,')) expect(line).toContain(value.meaning);
    }
    expect(described('HDEP T-shirt Bag').notes).toContain("HDEP isn't listed on its own. It matches Polymer, HDPE, B6.");

    const listed = described('5 oz Cold Paper Cup (listed size 6oz)');
    expect(listed.notes.some((note) => note.toLowerCase().includes('size'))).toBe(false);
    expect(listed.code).toBe('A5B24');
  });

  it('reads a vessel supplied with its lid as the combined product', () => {
    const cup = described('12oz PET Cups (2c Print) w/ Lids');
    expect(cup.facts.map((fact) => fact.meaning)).toEqual(['Cup with Cup Lid', 'Polymer, PET', '12 oz', '2 colours']);
    expect(cup.notes.some((note) => note.startsWith('Product type:'))).toBe(false);
    expect(cup.ignored).toEqual([]);
    expect(cup.code).toBe('A33B1R3-G112');

    expect(meanings('Bowl with Bowl Lid')).toEqual(['Bowl with Bowl Lid']);
    expect(meanings('Portion cup with lid')).toContain('Portion cup with Portion cup lid');
    expect(meanings('Container with lid')).toEqual(['Container with lid']);

    const bare = described('12oz PET Cups Lids');
    // No "with", "and" or "+" before the lid: the lid is the product, for 12 oz cups.
    expect(bare.notes[0]).toBe('The product is the lid. It goes on a 12 oz Cup. It is a Cup lid (A2).');
    expect(bare.code).toBe('A2B1');
  });

  it('stores a decimal capacity, only where its product has a capacity', () => {
    const cup = described('3.25 oz Portion Cup');
    expect(cup.code).toBe('A6-G13.25');
    expect(cup.facts.map((fact) => fact.meaning)).toEqual(['Portion cup', '3.25 oz']);
    expect(cup.notes.some((note) => note.includes('whole number'))).toBe(false);
    expect(described('12 oz Portion Cup').code).toBe('A6-G112');

    const lid = described('PET Clear lid for 3.25 oz Souffle Cup');
    expect(lid.code).toBe('A7B1D1');
    expect(lid.facts.map((fact) => fact.meaning)).not.toContain('3.25 oz');
  });

  it('reads a lid named by its vessel in any order, unless it is sold with the vessel', () => {
    expect(described('PET 2oz Cup Lids').code).toBe('A2B1');
    expect(described('PET 2oz Cup Lids').notes[0]).toBe('The product is the lid. It goes on a 2 oz Cup. It is a Cup lid (A2).');
    // Bagasse is the bowl's, PET the lid's: two materials, both left out.
    expect(described('32oz Bagasse Bowl PET Lids').code).toBe('A1');
    expect(described('Plastic Lid 32 oz Paper Bowl').notes[0]).toBe('The product is the lid. It goes on a 32 oz Bowl. It is a Bowl lid (A1).');
    const fitted = described('Plastic Lid fit for 6oz Deli Cup');
    expect(fitted.code).toBe('A2B11');
    expect(fitted.ignored).not.toContain('fit');

    expect(described('Bowl with Bowl Lid').code).toBe('A32');
    expect(described('Paper cup + lid').code).toBe('A33B24');
    expect(described('Portion cup with lid').code).toContain('A34');
  });

  it('reads a lid for a souffle cup as the portion cup lid', () => {
    const lid = described('PET Clear lid for 2 oz Souffle Cup');
    expect(lid.code).toBe('A7B1D1');
    expect(lid.facts.map((fact) => fact.meaning)).toEqual(['Portion cup lid', 'Polymer, PET', 'Clear']);
    expect(lid.notes[0]).toBe('The product is the lid. It goes on a 2 oz Souffle Cup. It is a Portion cup lid (A7).');
    expect(lid.notes).toContain('Nominal capacity does not apply to a portion cup lid.');
    expect(lid.notes.some((note) => note.includes('was left out'))).toBe(false);
    expect(lid.notes.some((note) => note.startsWith('Product type:'))).toBe(false);
    expect(lid.ignored).toEqual([]);

    expect(meanings('lid for bowl')).toEqual(['Bowl lid']);
    const cupLid = described('lid for 8 oz cup');
    expect(cupLid.code).toBe('A2');
    expect(meanings('Portion cup lid')).toEqual(['Portion cup lid']);
  });

  it('reads a size written twice as one, and no size twice in Left out', () => {
    const lid = described('96MM LIDS - WHITE, PP, 96mm');
    expect(lid.code).toBe('A2B3D3E1-H96');
    expect(lid.ignored).toEqual([]);
    expect(described('90mm PET Lid, PET, Top dia 90mm').code).toBe('A2B1E1-H90');
    expect(described('Cup 90mm, 80mm').code).toBe('A5');
    expect(described('96MM LIDS - KRAFT, Kraft, 96mm, 300+300+250').code).toBe('A2B12D4E1-H96');
    expect(described('98mm diameter PET dome lid').code).toBe('A2B1E1F1-H98');
  });

  it('reads supplier shorthand for print and wall: 1c print, SW, DW', () => {
    expect(described('PET Plastic Cups 16 oz (1c print)').code).toBe('A5B1R2-G116');
    expect(described('16oz PET CUP unprinted').code).toBe('A5B1R1-G116');
    expect(described('8 oz Paper Cup SW').code).toBe('A5B24Q1-G18');
    expect(described('12 oz Paper Cup DW').code).toBe('A5B24Q2-G112');
  });

  it('never stores a number with no unit as a capacity, and says how to write it', () => {
    const container = described('Printed 500 paper container');
    expect(container.code).toBe('A8B24');
    expect(container.notes).toContain('500 has no unit. If it is the capacity, write 500 ml or 500 oz.');
    // No bowl is 500 mm across, so it is no rim either.
    const bowl = described('Printed 500 paper bowl');
    expect(bowl.code).toBe('A3B24');
    expect(bowl.notes).toContain('500 has no unit. If it is the capacity, write 500 ml or 500 oz.');
    expect(described('Bowl lid 150').notes.some((note) => note.includes('has no unit'))).toBe(false);
  });

  it('reads one capacity written in two units, and still leaves out two amounts', () => {
    const cup = described('5 oz (150 ML) Cold Paper Cup');
    expect(cup.code).toBe('A5B24-G15');
    expect(cup.notes.some((note) => note.startsWith('Nominal capacity'))).toBe(false);
    expect(described('16 oz / 500 ml paper cup').code).toBe('A5B24-G116');

    const two = described('5 oz paper cup 500 ml');
    expect(two.code).toBe('A5B24');
    expect(two.notes.some((note) => note.startsWith('Nominal capacity was given as'))).toBe(true);
  });

  it('reads a grade over the family named beside it: Plastic and PET is PET, Paper and White Kraft is white kraft', () => {
    const cup = described('12 oz PET Plastic Cold Cup with 2 color print');
    expect(cup.facts).toContainEqual({ name: 'Material', meaning: 'Polymer, PET' });
    expect(cup.notes.some((note) => note.startsWith('Material:'))).toBe(false);

    expect(described('Twisted Handle Paper Bag, White Kraft').facts).toContainEqual({
      name: 'Material',
      meaning: 'Paper and paperboard, white kraft',
    });
  });

  it('still leaves out two grades, or a grade beside another family', () => {
    const grades = described('PET PP cup');
    expect(grades.notes).toContain('Material: PET is Polymer, PET (B1). PP is Polymer, PP (B3). Both were left out.');
    expect(grades.facts.map((fact) => fact.name)).not.toContain('Material');

    const families = described('Paper PET cup');
    expect(families.notes.some((note) => note.startsWith('Material:'))).toBe(true);
    expect(families.facts.map((fact) => fact.name)).not.toContain('Material');
  });
});
