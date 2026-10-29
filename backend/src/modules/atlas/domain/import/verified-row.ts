import { expectedFill } from '../applicability.js';
import type { Dictionary } from '../dictionary.js';
import { buildKeepingWhatFits } from '../build-keeping-what-fits.js';
import { describeText, factsInWords, type TextDescription } from '../reading/describe-text.js';
import { gradeOverFamily, kindOverGeneric, readText } from '../reading/read-text.js';
import { NAME_MAX_LENGTH } from '../saved-spec-id.js';
import { slotDefinition, type SlotKey } from '../slots.js';
import type { SpecIdFactsInput } from '../spec-id.js';

/** The verified list's quote columns, what one row quotes, and their names in the report (#56). */
export const QUOTE_COLUMNS = {
  fobPerUnit: 'FOB per unit',
  fobPerCase: 'FOB per case',
  fobTotal: 'FOB total',
  moldCost: 'Mold cost',
  moldLeadTime: 'Mold lead time',
  sampleLeadTime: 'Sample lead time',
  productionLeadTime: 'Production lead time',
} as const;
export type QuoteColumn = keyof typeof QUOTE_COLUMNS;

/**
 * One product row of the verified list: columns C to I as text, a number
 * written as the cell shows it (#28), and its manufacturer and quote (#56).
 */
export interface VerifiedRow {
  /** The workbook's own row number. */
  readonly row: number;
  readonly itemName: string;
  readonly category: string;
  /** The material's family: "Plastic", "Paper". */
  readonly material: string;
  /** The material itself: "HDPE", "White Kraft". */
  readonly materialType: string;
  /** Dimensions (mm). */
  readonly dimension: string;
  /** Product Weight (grams) / Thickness (gsm). */
  readonly weight: string;
  /** Printing details. */
  readonly printing: string;
  /** Column A, COMPANY, which heads its manufacturer's rows; empty outside every block. */
  readonly company: string;
  /** Column B, COUNTRY. */
  readonly country: string;
  /** The quote's columns as Excel shows them; empty when the cell is empty, or the sheet has no such column. */
  readonly quote: Readonly<Record<QuoteColumn, string>>;
  /** Columns of `quote` whose formula has no value saved in the workbook, so they are read empty. */
  readonly unsavedFormulas: readonly QuoteColumn[];
}

interface RowBase {
  readonly row: number;
  /** The item name a Spec ID would take: tidied, and cut to fit a name. */
  readonly name: string;
  /** True when the item name was longer than a name may be, and was cut. */
  readonly nameCut: boolean;
  /**
   * Whether the Category column alone names the product type the rest of the
   * row reads as, on a row where both name one; else null, as on a row whose
   * product type only the Category column names.
   */
  readonly agreement: boolean | null;
  /** The reader's notes: what it left out and why, and what a word could still mean (plan 0011). */
  readonly notes: readonly string[];
}

export type RowReading =
  | (RowBase & {
      readonly kind: 'read';
      readonly facts: Partial<SpecIdFactsInput> & { readonly productType: string };
      /** Each fact kept, as `Colour / clarity: Clear`, with the ruling and its words after one read under it. */
      readonly readFromRow: readonly string[];
    })
  | (RowBase & { readonly kind: 'skipped'; readonly reason: string });

export const NO_PRODUCT_TYPE = 'No product type in the item name, the material, the sizes or the category.';

/** Runs of whitespace, and characters a name may not hold, become one space. */
// eslint-disable-next-line no-control-regex -- matching control characters is the point
const tidy = (text: string) => text.replace(/[\u0000-\u001f\u007f\s]+/g, ' ').trim();

/** An item name over the most a name may hold is cut at the last space before it (#28). */
function nameOf(itemName: string): { name: string; cut: boolean } {
  const name = tidy(itemName);
  if (name.length <= NAME_MAX_LENGTH) return { name, cut: false };
  const space = name.lastIndexOf(' ', NAME_MAX_LENGTH);
  return { name: name.slice(0, space > 0 ? space : NAME_MAX_LENGTH).trimEnd(), cut: true };
}

/** The most text the reader reads, as Search does (#41). */
const TEXT_MAX_LENGTH = 500;

/** A weight cell with no unit: grams or gsm, the column does not say which. */
const BARE_NUMBER = /^\d+(?:\.\d+)?$/;

/**
 * Reads one verified-list row into facts with the description reader
 * (ADR 0026, ADR 0032), in two steps.
 *
 * The product type, from the item name; failing that, the Category column,
 * which also settles two the item name gives ("Portion cup … black
 * container"); failing that, the sizes, weight and printing as well, whose
 * "Container: … & Lid: …" can name it. The material cells name no product
 * type: their "Paper Tray" is no tray. But the Category column or a material
 * cell can name a kind of the general product the item name gives: "Dome
 * lids", with "Container Lid" in a cell, are container lids.
 *
 * The material, from the material cells read together ("Paper, Greaseproof"),
 * though a grade the item name gives is read over a family in the cells
 * ("PLA" beside "Plastic"), and over a vessel's a lid's name mentions; else
 * the item name's.
 *
 * Both are then final, and the rest of the row is read for every other fact,
 * the Dimension cell first, so a "Lid" or "Paper core" among the sizes
 * changes neither, and its millimetres are read over the item name's
 * unlabelled inches. The Category column fills only what the rest leaves
 * unsaid. A weight with no unit is in the column's grams or gsm: grams for a
 * product with no basis weight, a plastic lid's; gsm for one with no unit
 * weight; else it is not read.
 */
export function readVerifiedRow(row: VerifiedRow, dictionary: Dictionary): RowReading {
  const { name, cut } = nameOf(row.itemName);
  const materialWords = tidy(row.materialType) || tidy(row.material);
  const bareWeight = BARE_NUMBER.test(tidy(row.weight));
  const describe = (parts: readonly string[], productType?: string, material?: string): TextDescription =>
    describeText(
      parts
        .map(tidy)
        .filter((part) => part !== '')
        .join(', ')
        .slice(0, TEXT_MAX_LENGTH),
      dictionary,
      productType,
      material,
    );
  const typeOf = (description: TextDescription) =>
    description.specId === null || typeof description.facts.productType !== 'string' ? undefined : description.facts.productType;

  const cells = materialOfCells(row, dictionary);
  const categoryRead = readText(tidy(row.category), dictionary).facts.productType;
  const categoryType = typeof categoryRead === 'string' ? categoryRead : undefined;

  const named = describe([row.itemName], undefined, cells);
  let last = named;
  let productType = typeOf(named);
  let productNotes = named.productNotes;
  let fromCategory = false;
  const between = named.reading.conflicts.find((conflict) => conflict.key === 'productType')?.values ?? [];
  if (productType === undefined && categoryType !== undefined && between.includes(categoryType)) {
    [productType, productNotes, fromCategory] = [categoryType, [`The item name names ${between.length} product types; the Category column says which.`], true];
  }
  // "Invented pack + lid" filed as a lid names the lid only as what comes with it: the Category column does not say what it is.
  if (productType === undefined && !(named.reading.addOn !== undefined && named.reading.addOn === categoryType)) {
    last = describe([row.category, row.itemName], undefined, cells);
    [productType, productNotes, fromCategory] = [typeOf(last), last.productNotes, true];
  }
  if (productType === undefined) {
    last = describe([row.itemName, row.dimension, bareWeight ? '' : row.weight, row.printing], undefined, cells);
    [productType, productNotes, fromCategory] = [typeOf(last), last.productNotes, false];
  }

  for (const cell of productType === undefined ? [] : [row.category, row.materialType, row.material]) {
    const kind = readText(tidy(cell), dictionary).facts.productType;
    if (typeof kind !== 'string' || kind === productType || kindOverGeneric([productType ?? '', kind], dictionary) !== kind) continue;
    productNotes = [...productNotes, `${cell} names the kind of ${productLabel(productType ?? '', dictionary)}, so the product is ${productLabel(kind, dictionary)}.`];
    productType = kind;
    break;
  }

  const agreement = categoryType !== undefined && productType !== undefined && !fromCategory ? categoryType === productType : null;
  if (productType === undefined) {
    return { row: row.row, name, nameCut: cut, agreement, notes: last.notes, kind: 'skipped', reason: NO_PRODUCT_TYPE };
  }

  const material = materialOfRow(cells, readText(tidy(row.itemName), dictionary).facts.material, dictionary);
  const { weight, weightNotes } = bareWeight
    ? weightOf(tidy(row.weight), productType, material, dictionary)
    : { weight: row.weight, weightNotes: [] };
  const description = withCategory(
    describe([row.dimension, row.itemName, materialWords, weight, row.printing], productType, material),
    describe([row.category], productType, material),
    dictionary,
  );
  const read = new Map(description.reading.read.map((fact) => [fact.key, fact]));
  return {
    row: row.row,
    name,
    nameCut: cut,
    agreement,
    notes: [...productNotes, ...description.notes, ...weightNotes, ...smallSizes(description, tidy(row.dimension), productType, dictionary)],
    kind: 'read',
    facts: { ...description.facts, productType },
    readFromRow: factsInWords(description, dictionary).map(({ key, name: slot, meaning }) => {
      const fact = read.get(key);
      return `${slot}: ${meaning}${fact?.ruling ? ` (${fact.ruling}, from "${fact.words}")` : ''}`;
    }),
  };
}

/**
 * The material the cells name read together: by the word list, "Virgin
 * pulp" is tissue; and by the passes that read words together, "Paper,
 * Greaseproof" is greaseproof paper, where that is a grade of what the word
 * list read.
 */
function materialOfCells(row: VerifiedRow, dictionary: Dictionary): string | undefined {
  const text = [row.material, row.materialType].map(tidy).filter((cell) => cell !== '').join(', ');
  const asWords = readText(text, dictionary).facts.material;
  const together = describeText(text, dictionary).facts.material;
  const listed = typeof asWords === 'string' ? asWords : undefined;
  const combined = typeof together === 'string' ? together : undefined;
  if (listed === undefined || combined === undefined) return listed ?? combined;
  return gradeOverFamily([listed, combined], dictionary) ?? listed;
}

/**
 * A weight cell's bare number, as the weight it can only be: grams for a
 * product with no basis weight, gsm for one with no unit weight. With both, or
 * neither, it is not read, and a note says so.
 */
function weightOf(
  amount: string,
  productType: string,
  material: string | undefined,
  dictionary: Dictionary,
): { readonly weight: string; readonly weightNotes: readonly string[] } {
  const has = (key: 'unitWeight' | 'basisWeight') => expectedFill(dictionary, productType, key, undefined, material)?.fill === 'any';
  const [grams, gsm] = [has('unitWeight'), has('basisWeight')];
  if (grams && !gsm) return { weight: `${amount} g`, weightNotes: [`The weight ${amount} has no unit. ${productLabel(productType, dictionary)} of this material has no basis weight, so it is ${amount} g.`] };
  if (gsm && !grams) return { weight: `${amount} gsm`, weightNotes: [`The weight ${amount} has no unit. ${productLabel(productType, dictionary)} has no unit weight, so it is ${amount} gsm.`] };
  return { weight: '', weightNotes: [`The weight ${amount} has no unit, g or gsm, so it was not read.`] };
}

/** The most a side may be, in millimetres, before a size with no unit is flagged as likely inches or centimetres. */
const SMALL_SIDE_MM = 50;

/** A length unit written in a size: `mm`, `in`, an inch mark. */
const LENGTH_UNIT = /(?<![a-z])(?:mm|cm|in|inch|inches)(?![a-z])|"|''/i;

/**
 * A note for sizes written with no unit whose every side is under
 * `SMALL_SIDE_MM`: they are read as millimetres (#58), but "12 x 7.5 x 13" on
 * a bag, or "17 x 15.5 (Top Length x Width)" on a napkin, is likely inches,
 * so the row is worth a look. The sizes are a ruling's words, else the
 * Dimension cell's.
 */
function smallSizes(description: TextDescription, dimension: string, productType: string, dictionary: Dictionary): string[] {
  const ruled = description.reading.read.find((fact) => fact.ruling === 'R3' || fact.ruling === 'R5' || fact.ruling === 'R6');
  const sized = ruled?.words ?? dimension;
  if (sized === '' || LENGTH_UNIT.test(sized)) return [];
  const sides = (['length', 'width', 'height', 'gusset'] as const)
    .map((key) => description.facts[key])
    .filter((side): side is { value: string; unit: string } => side != null && typeof side === 'object');
  if (sides.length === 0 || sides.some((side) => Number(side.value) >= SMALL_SIDE_MM)) return [];
  return [`${sized} has no unit, so it was read in millimetres (#58). That is small for ${productLabel(productType, dictionary)}: check the unit.`];
}

/** A product type as a note names it: `Container lid (A9)`. */
function productLabel(code: string, dictionary: Dictionary): string {
  const meaning = dictionary.meaningOf('productType', code) ?? code;
  const number = dictionary.numberOf('productType', code);
  return number === undefined ? meaning : `${meaning} (A${number})`;
}

/**
 * The product's material: the cells', unless they name only a family and the
 * item name a grade of it ("Plastic" beside "PLA cup"); else the item name's.
 */
function materialOfRow(cells: string | undefined, itemName: unknown, dictionary: Dictionary): string | undefined {
  const own = typeof itemName === 'string' ? itemName : undefined;
  if (cells === undefined || own === undefined) return cells ?? own;
  return gradeOverFamily([cells, own], dictionary) === own ? own : cells;
}

/**
 * The row's own reading, with each fact the Category column gives that the
 * rest of the row neither gives nor gives two of: "Paper Cup - Double Wall"
 * says the wall, but not over "ripple wall".
 */
function withCategory(own: TextDescription, category: TextDescription, dictionary: Dictionary): TextDescription {
  // From every fact read, so a length waiting on the shape is kept once "Square" gives it.
  const facts: Record<string, unknown> = { ...own.drafted };
  const conflicted = new Set<string>(own.reading.conflicts.map((conflict) => conflict.key));
  let added = false;
  for (const [key, value] of Object.entries(category.facts)) {
    if (key === 'productType' || value == null || facts[key] != null || conflicted.has(key)) continue;
    facts[key] = value;
    added = true;
  }
  if (!added) return own;
  const kept = buildKeepingWhatFits(facts as Partial<SpecIdFactsInput>, dictionary);
  const nowKept = (note: string) =>
    Object.keys(kept.facts).some((key) => note.startsWith(`${slotDefinition(key as SlotKey).name} was left out.`));
  return { ...own, facts: kept.facts, specId: kept.specId, notes: own.notes.filter((note) => !nowKept(note)) };
}
