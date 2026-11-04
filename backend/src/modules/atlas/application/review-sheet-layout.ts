import { letterOf, SIZE_SLOTS, type CodedSlotKey } from '../domain/code.js';
import { SLOTS, type SlotKey } from '../domain/slots.js';
import type { ImportReport, ImportReportRow, ImportSourceCells } from './ports/import-report-sink.js';

/*
 * The review sheet's tabs, as what each holds rather than how a file draws it
 * (plan 0013, plan 0016): the Excel workbook and the shared Google Sheet are
 * both drawn from these, so the two never drift apart. A tab is its columns,
 * each in a band of colour, and its lines, each a cell per column or none.
 */

/** The band of colour a column is in: what the workbook said, what Atlas made, what it read, and the review. */
export type Band = 'source' | 'result' | 'read' | 'review';

export interface LayoutCell {
  readonly value: string | number;
  /** Shown on hover: where a fact was read. */
  readonly note?: string;
  /** The Rows line, by its key, the cell opens. */
  readonly linkTo?: string;
  /** The read-me's title, or one of its labels. */
  readonly emphasis?: 'title' | 'label';
}

export interface LayoutLine {
  /** One per column; null for an empty cell. */
  readonly cells: readonly (LayoutCell | null)[];
  /** A Spec IDs group's divider, shaded and ruled across the row (plan 0015). */
  readonly divider?: boolean;
  /** On the Rows tab: what the line is, so the shared sheet finds it again however it is sorted (plan 0016). */
  readonly key?: string;
}

export interface LayoutColumn {
  readonly name: string;
  /** In characters, as Excel measures a column. */
  readonly width: number;
  readonly band: Band | null;
  /** Hidden from view: the shared sheet's Atlas key (plan 0016). */
  readonly hidden?: boolean;
}

export interface LayoutTab {
  readonly name: string;
  /** A row of titles above the column names, each over its band's columns; none when the tab has one header row. */
  readonly bands: readonly { readonly title: string; readonly band: Band; readonly first: number; readonly count: number }[];
  readonly columns: readonly LayoutColumn[];
  /** Whether the column names are written: the read-me has none. */
  readonly header: boolean;
  readonly lines: readonly LayoutLine[];
  readonly frozen: { readonly rows: number; readonly columns: number };
  /** Whether the lines are filtered from the header row. */
  readonly filter: boolean;
  /** Whether each line is top-aligned and wrapped. */
  readonly wrap: boolean;
  /** The column offering Yes, No or Unsure; null when there is none. */
  readonly verdictColumn: number | null;
}

/** The review sheet's tabs, in the order they are shown. */
export interface ReviewLayout {
  readonly readMe: LayoutTab;
  readonly rows: LayoutTab;
  readonly specIds: LayoutTab;
  readonly needsALook: LayoutTab;
  readonly dictionary: LayoutTab;
}

export const SOURCE_COLUMNS: readonly (readonly [keyof ImportSourceCells, string])[] = [
  ['itemName', 'Item name'],
  ['category', 'Category'],
  ['material', 'Material'],
  ['materialType', 'Material type'],
  ['dimension', 'Dimension'],
  ['weight', 'Weight'],
  ['printing', 'Printing'],
];

/** The reviewer's columns on the Rows tab: Atlas writes their names once, and never what is under them. */
export const REVIEW_COLUMNS = ['Correct?', "What's wrong", 'Reviewer', 'Date'] as const;
export const VERDICTS = ['Yes', 'No', 'Unsure'] as const;

const SMALL_SIZE = /has no unit, so it was read in millimetres/;

/** One reason a row should be looked at first, in order of how likely it is to be wrong. */
interface Concern {
  readonly priority: number;
  readonly why: string;
}

export interface LayoutOptions {
  /** Each row's key, in the report's order; by default its place in the report. */
  readonly keys?: readonly string[];
  /** Whether the layout is the shared Google Sheet, which Atlas keeps in step: the read-me says how. */
  readonly shared?: boolean;
}

/** The review sheet of an import's report, or of the library as it stands. */
export function reviewLayout(report: ImportReport, options: LayoutOptions = {}): ReviewLayout {
  const keys = report.rows.map((_, index) => options.keys?.[index] ?? String(index));
  const factKeys = factKeysOf(report);
  return {
    readMe: readMeTab(report, options.shared ?? false),
    rows: rowsTab(report, keys, factKeys),
    specIds: specIdsTab(report, factKeys),
    needsALook: needsALookTab(report, keys),
    dictionary: dictionaryTab(report),
  };
}

/** The Spec IDs tab alone, for the download (plan 0016). */
export function specIdsLayout(report: ImportReport): LayoutTab {
  return specIdsTab(report, factKeysOf(report));
}

/** The facts any row holds, in slot order: one column each. */
function factKeysOf(report: ImportReport): SlotKey[] {
  return SLOTS.map(({ key }) => key).filter((key) => report.rows.some((row) => row.facts.some((fact) => fact.key === key)));
}

/** A fact's column name: `Material (B)`. */
export function factColumnName(key: SlotKey): string {
  const { name } = SLOTS.find((slot) => slot.key === key) ?? { name: key };
  return key === 'variant' ? name : `${name} (${letterOf(key as CodedSlotKey)})`;
}

/** The note on a fact's cell: where its words were read. */
function noteOf(fact: ImportReportRow['facts'][number]): string | undefined {
  if (fact.words === '' && fact.cell === null) return undefined;
  const from = fact.words === '' ? `From ${fact.cell}` : fact.cell === null ? `From "${fact.words}"` : `From ${fact.cell}: "${fact.words}"`;
  return fact.ruling === null ? from : `${from}, read under ${fact.ruling}`;
}

function cell(value: string | number, extra: Omit<LayoutCell, 'value'> = {}): LayoutCell {
  return { value, ...extra };
}

/** The columns of a run of names, all in one band, each its width. */
function columnsOf(names: readonly string[], widths: readonly number[], band: Band | null): LayoutColumn[] {
  return names.map((name, index) => ({ name, width: widths[index] ?? 18, band }));
}

/** The Rows tab's last column on the shared sheet: each line's key, hidden (plan 0016). */
export const KEY_COLUMN = 'Atlas key';

/** The Rows tab's columns before the facts, then after them: Atlas's own, every one. */
export const ROWS_LEADING = ['Row', ...SOURCE_COLUMNS.map(([, name]) => name), 'Code', 'Outcome', 'Category agrees?'] as const;
export const ROWS_TRAILING = ['Left out', 'Notes', 'Dropped'] as const;

function rowsTab(report: ImportReport, keys: readonly string[], factKeys: readonly SlotKey[]): LayoutTab {
  const source = columnsOf(['Row', ...SOURCE_COLUMNS.map(([, name]) => name)], [6, 40, 18, 14, 18, 24, 12, 18], 'source');
  const result = columnsOf(['Code', 'Outcome', 'Category agrees?'], [28, 16, 10], 'result');
  const read = columnsOf([...factKeys.map(factColumnName), ...ROWS_TRAILING], [...factKeys.map(() => 18), 20, 50, 30], 'read');
  const review = columnsOf([...REVIEW_COLUMNS], [10, 40, 14, 12], 'review');
  const lines = report.rows.map((entry, index): LayoutLine => {
    const facts = factKeys.map((key) => {
      const fact = entry.facts.find((candidate) => candidate.key === key);
      if (!fact) return null;
      const note = noteOf(fact);
      return cell(fact.meaning, note === undefined ? {} : { note });
    });
    return {
      key: keys[index],
      cells: [
        // A Spec ID saved in Atlas has no workbook row.
        cell(entry.row === 0 ? '' : entry.row),
        ...SOURCE_COLUMNS.map(([key]) => cell(entry.source[key])),
        cell(entry.code ?? ''),
        cell(entry.outcome === 'skipped' ? `skipped: ${entry.reason ?? ''}` : entry.outcome),
        cell(entry.categoryAgrees === null ? '' : entry.categoryAgrees ? 'Yes' : 'No'),
        ...facts,
        cell(entry.leftOut.join(', ')),
        cell(entry.flags.join('\n')),
        cell(entry.dropped.join('\n')),
        ...REVIEW_COLUMNS.map(() => null),
      ],
    };
  });
  return {
    name: 'Rows',
    bands: [
      { title: 'What the workbook said', band: 'source', first: 0, count: source.length },
      { title: 'What Atlas made', band: 'result', first: source.length, count: result.length },
      { title: 'What Atlas read (hover a fact to see where it came from)', band: 'read', first: source.length + result.length, count: read.length },
      { title: 'Your review', band: 'review', first: source.length + result.length + read.length, count: review.length },
    ],
    columns: [...source, ...result, ...read, ...review],
    header: true,
    lines,
    frozen: { rows: 2, columns: 2 },
    filter: true,
    wrap: true,
    verdictColumn: source.length + result.length + read.length,
  };
}

function readMeTab(report: ImportReport, shared: boolean): LayoutTab {
  const { summary } = report;
  const lines: readonly (readonly [string, string?])[] = [
    ['Atlas code review'],
    [''],
    ['What this is', 'Every row of the verified list, the code Atlas gave it, and what Atlas read from the row to make that code. Check that what was read matches what the row says.'],
    ...(shared
      ? [['Kept by Atlas', 'Atlas keeps this sheet in step with the library, a minute after anything in it changes. Write only in the purple Your review columns on the Rows tab: Atlas rewrites every other column there, and every other tab, each time. A row Atlas no longer has stays, with its review, its Outcome reading "No longer in Atlas".'] as const]
      : []),
    ['Rows', 'One line per workbook row. Grey: the cells as the workbook wrote them. Yellow: the code and what happened to the row. Green: each fact Atlas read, one column per fact. Hover a green cell to see which cell and words it came from. Purple: your review.'],
    ['Your review', 'Choose Yes, No or Unsure under "Correct?". For No, say what is wrong: the fact that is wrong, missing or extra, and what it should be.'],
    ['A blank fact', 'Atlas did not find it, so the code leaves it out. It is not known, rather than wrong, unless the row does say it.'],
    ['Left out', 'Words no rule used. A product word or size here may be something Atlas missed.'],
    ['Notes', 'What Atlas noticed: a fact the row gives two values for, a size with no unit, a word that could mean several things.'],
    ['Same as row N', 'This row describes exactly the same product as row N, so it shares that row\'s Spec ID and code. If the two rows are different products, the code is missing what tells them apart.'],
    ['Already saved', 'The first row of its Spec ID when the sheet comes from Atlas: the import saved its code. Rows after it read "Same as row N".'],
    ['Saved in Atlas', 'A Spec ID saved by hand in Atlas, not imported: it has no workbook row or cells, only its facts.'],
    ['Spec IDs', 'One line per code, with the rows that share it. Look for rows whose names differ but share one code. The codes are grouped by their facts, the part before the hyphen: each group is the same product in its sizes, under a shaded divider naming it. A code with no sizes heads its group. To see one group alone, filter the Facts column on its code.'],
    ['Needs a look', 'The rows most likely to be wrong, most likely first. A good place to start.'],
    ['Dictionary', 'What each number in a code means. A code is a letter and a number per fact: A is the product type, B the material, and so on; the sizes come after the hyphen. B25 is material 25, Molded fibre, bagasse. J110 is a height of 110 mm.'],
    ['Sizes', 'H top diameter, I bottom diameter, J height, K length, L width, M gusset: millimetres. N unit weight: tenths of a gram (N33 is 3.3 g). O basis weight: gsm. P thickness: micrometres. G capacity: the unit\'s number, then the amount (G112 is 12 oz).'],
    [''],
    ['Rows read', String(summary.rows)],
    ['Spec IDs', String(summary.created + summary.alreadySaved)],
    ['Rows sharing an earlier row\'s code', String(summary.sameAs)],
    ['Rows skipped', String(summary.skipped)],
    ['Category agreed with the rest of the row', `${summary.agreement.agreed} of ${summary.agreement.compared}`],
  ];
  return {
    name: 'How to read this',
    bands: [],
    columns: columnsOf(['', ''], [34, 110], null),
    header: false,
    lines: lines.map(([label, text], index) => ({
      cells: [cell(label, { emphasis: index === 0 ? 'title' : 'label' }), text === undefined ? null : cell(text)],
    })),
    frozen: { rows: 0, columns: 0 },
    filter: false,
    wrap: true,
    verdictColumn: null,
  };
}

/** A code's two parts: the facts before the hyphen, `A3B25C8E1`, and the sizes after it, `G125`; none when it has no hyphen. */
export function partsOfCode(code: string): { readonly facts: string; readonly sizes: string } {
  const hyphen = code.indexOf('-');
  return hyphen === -1 ? { facts: code, sizes: '' } : { facts: code.slice(0, hyphen), sizes: code.slice(hyphen + 1) };
}

/**
 * Two codes in the order a person reads them: part by part, each part's
 * letter, then its number as a number, so A3 comes before A10, and a code that
 * stops sooner comes first.
 */
export function compareCodes(a: string, b: string): number {
  const partsOf = (code: string) => [...code.matchAll(/([A-Z])(\d+(?:\.\d+)?)/g)].map(([, letter = '', number = '0']) => ({ letter, number: Number(number) }));
  const [left, right] = [partsOf(a), partsOf(b)];
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    const [x, y] = [left[index], right[index]];
    if (!x || !y) break;
    if (x.letter !== y.letter) return x.letter < y.letter ? -1 : 1;
    if (x.number !== y.number) return x.number - y.number;
  }
  return left.length - right.length;
}

/** A group's divider: its facts code, what they say, and how many Spec IDs and rows it holds. */
function dividerOf(facts: string, members: readonly (readonly ImportReportRow[])[]): string {
  const first = members[0]?.[0];
  const said = (first?.facts ?? []).filter((fact) => !SIZE_SLOTS.has(fact.key)).map((fact) => fact.meaning);
  const rows = members.reduce((count, group) => count + group.filter((member) => member.row !== 0).length, 0);
  const specIds = `${members.length} Spec ID${members.length === 1 ? '' : 's'}`;
  return [facts, said.join(', '), rows > 0 ? `${specIds}, ${rows} row${rows === 1 ? '' : 's'}` : specIds].filter((part) => part !== '').join('  ·  ');
}

/**
 * One line per code, grouped by its facts (plan 0015): every Spec ID whose
 * code begins with the same facts, with any sizes or none, under one divider
 * line that names them, the groups and their Spec IDs in code order. Each
 * line, the divider's too, holds its Facts, so a filter on Facts finds a
 * group whole. Nothing is merged or folded: Google Sheets opens an outline
 * folded shut, hiding every Spec ID, and cannot sort or filter merged rows.
 */
function specIdsTab(report: ImportReport, factKeys: readonly SlotKey[]): LayoutTab {
  const byCode = new Map<string, ImportReportRow[]>();
  for (const row of report.rows) if (row.code !== null) byCode.set(row.code, [...(byCode.get(row.code) ?? []), row]);
  const byFacts = new Map<string, string[]>();
  for (const code of [...byCode.keys()].sort(compareCodes)) {
    const { facts } = partsOfCode(code);
    byFacts.set(facts, [...(byFacts.get(facts) ?? []), code]);
  }

  const lines: LayoutLine[] = [];
  for (const [facts, codes] of [...byFacts.entries()].sort(([a], [b]) => compareCodes(a, b))) {
    lines.push({
      divider: true,
      cells: [cell(dividerOf(facts, codes.map((code) => byCode.get(code) ?? []))), cell(facts), ...factKeys.map(() => null), null, null, null, null, null],
    });
    for (const code of codes) {
      const members = byCode.get(code) ?? [];
      const names = [...new Set(members.map((member) => member.itemName.trim()))];
      const numbers = members.map((member) => member.row).filter((number) => number !== 0);
      const [first] = members;
      lines.push({
        cells: [
          cell(code),
          cell(facts),
          cell(partsOfCode(code).sizes),
          cell(numbers.length),
          cell(numbers.join(', ')),
          cell(names.join('\n')),
          cell(names.length > 1 ? 'Yes' : ''),
          ...factKeys.map((key) => {
            const fact = first?.facts.find((candidate) => candidate.key === key);
            return fact ? cell(fact.meaning) : null;
          }),
        ],
      });
    }
  }
  return {
    name: 'Spec IDs',
    bands: [],
    // Code is wide enough for a divider's words on two lines at most.
    columns: [
      ...columnsOf(['Code', 'Facts', 'Sizes', 'Rows', 'Row numbers', 'Item names', 'Names differ?'], [44, 18, 16, 6, 16, 50, 10], 'result'),
      ...columnsOf(factKeys.map(factColumnName), factKeys.map(() => 18), 'read'),
    ],
    header: true,
    lines,
    frozen: { rows: 1, columns: 1 },
    filter: true,
    wrap: true,
    verdictColumn: null,
  };
}

/** Why a row should be looked at first; null when nothing points at it. */
function concernOf(row: ImportReportRow, sharedNames: ReadonlyMap<string, number>): Concern | null {
  if (row.outcome === 'skipped') return { priority: 1, why: `Skipped: ${row.reason ?? ''}` };
  if (row.flags.some((flag) => SMALL_SIZE.test(flag))) return { priority: 2, why: 'A size with no unit, read in millimetres: check it is not inches' };
  if (row.code !== null && (sharedNames.get(row.code) ?? 1) > 1) return { priority: 3, why: 'Shares its code with rows of another name: check they are one product' };
  if (row.categoryAgrees === false) return { priority: 4, why: 'The Category column names another product type' };
  if (row.dropped.length > 0) return { priority: 5, why: 'A fact read was refused by the rules and left out of the code' };
  if (row.flags.length > 0 || row.leftOut.length > 0) return { priority: 6, why: 'Atlas left notes, or words it did not use' };
  return null;
}

function needsALookTab(report: ImportReport, keys: readonly string[]): LayoutTab {
  const names = new Map<string, Set<string>>();
  for (const row of report.rows) {
    if (row.code === null) continue;
    names.set(row.code, (names.get(row.code) ?? new Set()).add(row.itemName.trim()));
  }
  const sharedNames = new Map([...names.entries()].map(([code, set]) => [code, set.size]));
  const flagged = report.rows
    .map((row, index) => ({ row, key: keys[index] ?? String(index), concern: concernOf(row, sharedNames) }))
    .filter((entry): entry is { row: ImportReportRow; key: string; concern: Concern } => entry.concern !== null)
    .sort((a, b) => a.concern.priority - b.concern.priority || a.row.row - b.row.row);
  return {
    name: 'Needs a look',
    bands: [],
    columns: columnsOf(['Priority', 'Why', 'Row', 'Item name', 'Code', 'What Atlas read', 'Notes'], [8, 40, 6, 40, 28, 40, 60], 'result'),
    header: true,
    lines: flagged.map(({ row, key, concern }) => ({
      cells: [
        cell(concern.priority),
        cell(concern.why),
        // The row number opens the row on the Rows tab, where the review is written.
        cell(String(row.row), { linkTo: key }),
        cell(row.itemName),
        cell(row.code ?? ''),
        cell(row.facts.map((fact) => `${fact.name}: ${fact.meaning}`).join('\n')),
        cell([...row.flags, ...(row.leftOut.length > 0 ? [`Left out: ${row.leftOut.join(', ')}`] : [])].join('\n')),
      ],
    })),
    frozen: { rows: 1, columns: 0 },
    filter: true,
    wrap: true,
    verdictColumn: null,
  };
}

function dictionaryTab(report: ImportReport): LayoutTab {
  return {
    name: 'Dictionary',
    bands: [],
    columns: columnsOf(['List', 'Part', 'Meaning'], [20, 8, 50], null),
    header: true,
    lines: report.options.map((option) => ({ cells: [cell(option.list), cell(option.part), cell(option.meaning)] })),
    frozen: { rows: 1, columns: 0 },
    filter: true,
    wrap: false,
    verdictColumn: null,
  };
}
