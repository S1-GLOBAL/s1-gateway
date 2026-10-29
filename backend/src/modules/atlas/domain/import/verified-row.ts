import type { Dictionary } from '../dictionary.js';
import { describeText, factsInWords, type TextDescription } from '../reading/describe-text.js';
import { readText } from '../reading/read-text.js';
import { NAME_MAX_LENGTH } from '../saved-spec-id.js';
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
   * row reads as, on a row where both name one; else null.
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

/**
 * Reads one verified-list row into facts with the description reader
 * (ADR 0026, ADR 0032): the item name, the material, the sizes, the weight
 * and the printing, as one description. The material type is read over the
 * material's family, since "Plastic" beside "HDPE" would read as two
 * materials; the category only when nothing else names the product type, since
 * its "Plastic …" does the same.
 */
export function readVerifiedRow(row: VerifiedRow, dictionary: Dictionary): RowReading {
  const { name, cut } = nameOf(row.itemName);
  const described = (category: string): TextDescription =>
    describeText(
      [row.itemName, category, tidy(row.materialType) || row.material, row.dimension, row.weight, row.printing]
        .map(tidy)
        .filter((part) => part !== '')
        .join(', ')
        .slice(0, TEXT_MAX_LENGTH),
      dictionary,
    );
  const plain = described('');
  const description = plain.specId === null ? described(row.category) : plain;

  const categoryType = readText(tidy(row.category), dictionary).facts.productType;
  const ownType = plain.facts.productType;
  const agreement = typeof categoryType === 'string' && typeof ownType === 'string' ? categoryType === ownType : null;
  const productType = description.facts.productType;
  const base = { row: row.row, name, nameCut: cut, agreement, notes: description.notes };
  if (description.specId === null || productType === undefined) return { ...base, kind: 'skipped', reason: NO_PRODUCT_TYPE };

  const read = new Map(description.reading.read.map((fact) => [fact.key, fact]));
  return {
    ...base,
    kind: 'read',
    facts: { ...description.facts, productType },
    readFromRow: factsInWords(description, dictionary).map(({ key, name: slot, meaning }) => {
      const fact = read.get(key);
      return `${slot}: ${meaning}${fact?.ruling ? ` (${fact.ruling}, from "${fact.words}")` : ''}`;
    }),
  };
}
