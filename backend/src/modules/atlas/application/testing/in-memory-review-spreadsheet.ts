import type { ReviewSpreadsheet, RowsEdit, RowsLinks, SheetCell, SheetTab } from '../ports/review-spreadsheet.js';
import type { LayoutTab } from '../review-sheet-layout.js';

const EMPTY: SheetCell = { text: '', note: '' };

interface Tab {
  id: number;
  name: string;
  grid: SheetCell[][];
  hidden: Set<number>;
  verdicts: Set<string>;
  /** Each link cell's target, as `row,column` → `tab:row`. */
  links: Map<string, string>;
}

/**
 * A spreadsheet in memory, for the sync's tests (plan 0016): each tab a grid
 * of cells, changed as the Google adapter changes the real one. Reviewers'
 * work is written straight into a grid with `type`, and a sort or anything
 * else done between two reads with `onRead`.
 */
export class InMemoryReviewSpreadsheet implements ReviewSpreadsheet {
  private readonly sheets: Tab[] = [];
  private nextId = 100;
  readonly calls: string[] = [];
  /** Run just before each read of a tab, with its number, from 1: for a reviewer acting mid-sync. */
  onRead: ((reads: number) => void) | null = null;
  private reads = 0;

  /** A tab, as a list of rows of text: the sheet as someone uploaded or typed it. */
  addTab(name: string, rows: readonly (readonly string[])[]): void {
    this.sheets.push({
      id: this.nextId++,
      name,
      grid: rows.map((row) => row.map((text) => ({ text, note: '' }))),
      hidden: new Set(),
      verdicts: new Set(),
      links: new Map(),
    });
  }

  /** What a reviewer types into a cell. */
  type(name: string, row: number, column: number, text: string): void {
    const grid = this.tab(name).grid;
    while (grid.length <= row) grid.push([]);
    const line = grid[row] as SheetCell[];
    while (line.length <= column) line.push(EMPTY);
    line[column] = { text, note: line[column]?.note ?? '' };
  }

  /** Sorts a tab's rows below `headerRows` by one column, as a reviewer might. */
  sort(name: string, headerRows: number, column: number, descending = false): void {
    const grid = this.tab(name).grid;
    const body = grid.splice(headerRows);
    body.sort((a, b) => (a[column]?.text ?? '').localeCompare(b[column]?.text ?? '', 'en', { numeric: true }) * (descending ? -1 : 1));
    grid.push(...body);
  }

  /** A tab's cells as text, row by row, trailing empties dropped. */
  textOf(name: string): string[][] {
    return this.tab(name).grid.map((row) => {
      const texts = row.map((cell) => cell.text);
      while (texts.length > 0 && texts.at(-1) === '') texts.pop();
      return texts;
    });
  }

  /** A note a reviewer adds to a cell. */
  annotate(name: string, row: number, column: number, note: string): void {
    const line = this.tab(name).grid[row] as SheetCell[];
    while (line.length <= column) line.push(EMPTY);
    line[column] = { text: line[column]?.text ?? '', note };
  }

  noteAt(name: string, row: number, column: number): string {
    return this.tab(name).grid[row]?.[column]?.note ?? '';
  }

  hiddenColumns(name: string): number[] {
    return [...this.tab(name).hidden];
  }

  hasVerdict(name: string, row: number, column: number): boolean {
    return this.tab(name).verdicts.has(`${row},${column}`);
  }

  linkAt(name: string, row: number, column: number): string | undefined {
    return this.tab(name).links.get(`${row},${column}`);
  }

  names(): string[] {
    return this.sheets.map((tab) => tab.name);
  }

  async tabs(): Promise<SheetTab[]> {
    this.calls.push('tabs');
    return this.sheets.map((tab) => ({
      id: tab.id,
      name: tab.name,
      rows: tab.grid.length,
      columns: Math.max(0, ...tab.grid.map((row) => row.length)),
    }));
  }

  async read(tab: SheetTab): Promise<SheetCell[][]> {
    this.calls.push(`read ${tab.name}`);
    this.reads += 1;
    this.onRead?.(this.reads);
    return this.byId(tab.id).grid.map((row) => row.map((cell) => ({ ...cell })));
  }

  async editRows(tab: SheetTab, edit: RowsEdit): Promise<void> {
    this.calls.push(`edit ${tab.name}`);
    const sheet = this.byId(tab.id);
    for (const at of edit.insertColumns) for (const row of sheet.grid) if (row.length > at) row.splice(at, 0, EMPTY);
    while (sheet.grid.length < edit.rows) sheet.grid.push([]);
    for (const { row, column, value, note } of edit.writes) {
      const line = sheet.grid[row] as SheetCell[];
      while (line.length <= column) line.push(EMPTY);
      line[column] = { text: String(value), note: note ?? line[column]?.note ?? '' };
    }
    for (const { row, column } of edit.verdicts) sheet.verdicts.add(`${row},${column}`);
    for (const column of edit.hideColumns) sheet.hidden.add(column);
  }

  async replace(layout: LayoutTab, existing: SheetTab | null, links: RowsLinks): Promise<void> {
    this.calls.push(`replace ${layout.name}`);
    let sheet = existing === null ? undefined : this.byId(existing.id);
    if (sheet === undefined) {
      this.addTab(layout.name, []);
      sheet = this.tab(layout.name);
    }
    const grid: SheetCell[][] = [];
    if (layout.bands.length > 0) {
      const top = layout.columns.map(() => EMPTY);
      for (const band of layout.bands) top[band.first] = { text: band.title, note: '' };
      grid.push(top);
    }
    if (layout.header) grid.push(layout.columns.map((column) => ({ text: column.name, note: '' })));
    sheet.links.clear();
    for (const line of layout.lines) {
      const row = grid.length;
      grid.push(
        line.cells.map((cell, column) => {
          if (cell === null) return EMPTY;
          if (cell.linkTo !== undefined) sheet.links.set(`${row},${column}`, `${links.tab}:${links.rowOf(cell.linkTo)}`);
          return { text: String(cell.value), note: cell.note ?? '' };
        }),
      );
    }
    sheet.grid = grid;
    sheet.hidden = new Set(layout.columns.flatMap((column, index) => (column.hidden === true ? [index] : [])));
    sheet.verdicts = new Set(
      layout.verdictColumn === null ? [] : layout.lines.map((_, index) => `${grid.length - layout.lines.length + index},${layout.verdictColumn}`),
    );
  }

  private tab(name: string): Tab {
    const tab = this.sheets.find((candidate) => candidate.name === name);
    if (!tab) throw new Error(`No tab ${name}`);
    return tab;
  }

  private byId(id: number): Tab {
    const tab = this.sheets.find((candidate) => candidate.id === id);
    if (!tab) throw new Error(`No tab ${id}`);
    return tab;
  }
}
