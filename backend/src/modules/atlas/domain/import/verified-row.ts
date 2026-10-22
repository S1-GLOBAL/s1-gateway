import type { Dictionary } from '../dictionary.js';
import { readText } from '../reading/read-text.js';
import { readSize, type Ruling } from '../reading/size-rulings.js';
import { NAME_MAX_LENGTH } from '../saved-spec-id.js';
import type { SlotKey } from '../slots.js';
import type { MeasurementInput, SpecIdFactsInput } from '../spec-id.js';

/** Columns O to U of the verified list, what one row quotes, and their names in the report (#56). */
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
 * One product row of the verified list: columns C to G as text, a number
 * written as the cell shows it (#28), and its manufacturer and quote (#56).
 */
export interface VerifiedRow {
  /** The workbook's own row number. */
  readonly row: number;
  readonly itemName: string;
  readonly category: string;
  readonly material: string;
  /** Dimension (mm). */
  readonly dimension: string;
  /** Product Weight (grams) / Thickness (gsm). */
  readonly weight: string;
  /** Column A, COMPANY, which heads its manufacturer's rows; empty outside every block. */
  readonly company: string;
  /** Column B, COUNTRY. */
  readonly country: string;
  /** Columns O to U as Excel shows them; empty when the cell is. */
  readonly quote: Readonly<Record<QuoteColumn, string>>;
  /** Columns of `quote` whose formula has no value saved in the workbook, so are read empty. */
  readonly unsavedFormulas: readonly QuoteColumn[];
}

/** A fact the report lists: read from the item name, or under one of #28's rulings. */
export interface RowNote {
  readonly key: SlotKey;
  /** The words it was read from, as the row wrote them. */
  readonly words: string;
  readonly ruling: Ruling | null;
}

interface RowBase {
  readonly row: number;
  /** The item name a Spec ID would take: tidied, and cut to fit a name. */
  readonly name: string;
  /** True when the item name was longer than a name may be, and was cut. */
  readonly nameCut: boolean;
  /**
   * Whether the item name reads the same product type and material as the
   * Category and Material columns, on a row where both give one; else null.
   */
  readonly agreement: boolean | null;
}

export type RowReading =
  | (RowBase & {
      readonly kind: 'read';
      readonly facts: Partial<SpecIdFactsInput> & { readonly productType: string };
      /** Facts read from the item name, which the columns did not give. */
      readonly fromItemName: readonly RowNote[];
      /** Facts read under a ruling, from the item name or the Dimension column. */
      readonly underRuling: readonly RowNote[];
    })
  | (RowBase & { readonly kind: 'skipped'; readonly reason: string });

export const NO_PRODUCT_TYPE = 'No product type in the Category, Material or item name.';

type Facts = Record<string, unknown>;

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

/**
 * The Category and Material cells read together: whichever column names the
 * product type or the material, it counts, so swapped columns read the right
 * way round. Two different values for one slot leave it out.
 */
function readColumns(row: VerifiedRow, dictionary: Dictionary): Facts {
  const facts: Facts = {};
  const disputed = new Set<string>();
  for (const cell of [row.category, row.material]) {
    for (const [key, value] of Object.entries(readText(tidy(cell), dictionary).facts)) {
      if (disputed.has(key)) continue;
      if (facts[key] === undefined) facts[key] = value;
      else if (JSON.stringify(facts[key]) !== JSON.stringify(value)) {
        delete facts[key];
        disputed.add(key);
      }
    }
  }
  return facts;
}

/** Column G: a number with `g` is a unit weight, with `gsm` a basis weight; anything else is not read. */
function readWeight(cell: string): Facts {
  const text = tidy(cell).toLowerCase();
  const grams = /^(\d+(?:\.\d+)?)\s*(?:g|grams?)$/.exec(text);
  if (grams) return { unitWeight: { value: grams[1] ?? '', unit: 'g' } satisfies MeasurementInput };
  const gsm = /^(\d+(?:\.\d+)?)\s*gsm$/.exec(text);
  if (gsm) return { basisWeight: { value: gsm[1] ?? '', unit: 'gsm' } satisfies MeasurementInput };
  return {};
}

/**
 * Reads one verified-list row into facts (#28, plan 0006): the Category and
 * Material columns first, then the item name through Search's reader (ADR
 * 0026), the Dimension column through #28's rulings, and the weight column.
 * A column's value wins over the item name's.
 */
export function readVerifiedRow(row: VerifiedRow, dictionary: Dictionary): RowReading {
  const { name, cut } = nameOf(row.itemName);
  const columns = { ...readColumns(row, dictionary), ...readWeight(row.weight) };
  const columnType = typeof columns.productType === 'string' ? columns.productType : undefined;

  const plain = readText(tidy(row.itemName), dictionary);
  const agreement = agreementOf(columns, plain.facts);

  const item = columnType === undefined ? plain : readText(tidy(row.itemName), dictionary, columnType);
  const facts: Facts = { ...item.facts, ...columns };
  const productType = typeof facts.productType === 'string' ? facts.productType : undefined;
  if (productType === undefined) return { kind: 'skipped', row: row.row, name, nameCut: cut, agreement, reason: NO_PRODUCT_TYPE };

  const fromItemName = item.read.filter((note) => note.key !== 'productType' && columns[note.key] === undefined);
  const underRuling = fromItemName.filter((note) => note.ruling !== null);

  // The Dimension column wins over a size the item name gave; a round ruling never overrides a shape that is not round.
  const dimension = tidy(row.dimension);
  const size = dimension === '' ? null : readSize(dimension.toLowerCase(), productType);
  const columnRulings: RowNote[] = [];
  if (size && !(size.facts.shape === 'RD' && typeof facts.shape === 'string' && facts.shape !== 'RD')) {
    for (const [key, value] of Object.entries(size.facts)) {
      facts[key] = value;
      columnRulings.push({ key: key as SlotKey, words: dimension, ruling: size.ruling });
    }
  }
  const overridden = new Set(columnRulings.map(({ key }) => key));

  return {
    kind: 'read',
    row: row.row,
    name,
    nameCut: cut,
    agreement,
    facts: { ...facts, productType } as Partial<SpecIdFactsInput> & { productType: string },
    fromItemName: fromItemName.filter((note) => !overridden.has(note.key)),
    underRuling: [...underRuling.filter((note) => !overridden.has(note.key)), ...columnRulings],
  };
}

/** Product type and material, where both the columns and the item name give one. */
function agreementOf(columns: Facts, itemName: Partial<SpecIdFactsInput>): boolean | null {
  const compared = (['productType', 'material'] as const).filter(
    (key) => columns[key] !== undefined && itemName[key] !== undefined,
  );
  if (compared.length === 0) return null;
  return compared.every((key) => columns[key] === itemName[key]);
}
