import { writeFile } from 'node:fs/promises';
import type { ImportReport, ImportReportSink } from '../application/ports/import-report-sink.js';

const HEADER = ['Row', 'Item name', 'Outcome', 'Code', 'Manufacturer', 'Quote', 'Reason skipped', 'Read from the row', 'Dropped', 'Flags'];

/** A cell, quoted when it holds a comma, a quote or a line break. */
function cell(value: string | number | null): string {
  const text = value === null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const csvLine = (values: readonly (string | number | null)[]) => values.map(cell).join(',');

/**
 * Writes #28's report, with #56's manufacturer and quote, as UTF-8 CSV to a
 * path outside the repository: the totals first, then a blank line, then a
 * header and one line per product row. Several facts in one cell are joined
 * with "; ".
 */
export class CsvImportReport implements ImportReportSink {
  constructor(private readonly path: string) {}

  async write(report: ImportReport): Promise<void> {
    const { summary } = report;
    const lines = [
      csvLine(['Rows read', summary.rows]),
      csvLine(['Spec IDs created', summary.created]),
      csvLine(['Rows the same as an earlier row', summary.sameAs]),
      csvLine(['Spec IDs already saved', summary.alreadySaved]),
      csvLine(['Rows skipped', summary.skipped]),
      csvLine(['Manufacturers found', summary.manufacturers]),
      csvLine(['Quotes recorded', summary.quotes]),
      csvLine(['Item name agreed with Category and Material', `${summary.agreement.agreed} of ${summary.agreement.compared}`]),
      '',
      csvLine(HEADER),
      ...report.rows.map((row) =>
        csvLine([
          row.row,
          row.itemName,
          row.outcome,
          row.code,
          row.manufacturer,
          row.quote,
          row.reason,
          row.readFromRow.join('; '),
          row.dropped.join('; '),
          row.flags.join('; '),
        ]),
      ),
    ];
    await writeFile(this.path, `${lines.join('\n')}\n`, 'utf8');
  }
}
