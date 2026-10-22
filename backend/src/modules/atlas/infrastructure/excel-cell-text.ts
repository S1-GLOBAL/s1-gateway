import ExcelJS from 'exceljs';

/** A cell as Excel shows it, or that its formula has no saved value to show. */
export type ShownCell = { readonly text: string } | { readonly unsavedFormula: true };

/**
 * A cell as Excel shows it: a number in its number format, `0.035` under
 * `"$"#,##0.0000` as `$0.0350`. A formula shows the value Excel saved with
 * it; a workbook saved by a tool that never calculates has none, and that is
 * said rather than guessed. Anything else is the cell's text, trimmed.
 */
export function shownCell(cell: ExcelJS.Cell): ShownCell {
  if (cell.type === ExcelJS.ValueType.Formula) {
    const { result } = cell.value as ExcelJS.CellFormulaValue;
    if (result === undefined || result === null) return { unsavedFormula: true };
    if (typeof result === 'number') return { text: formatNumber(result, cell.numFmt) };
    // An error Excel saved, such as `#DIV/0!`, shows as Excel shows it.
    if (typeof result === 'object' && 'error' in result) return { text: String(result.error) };
    return { text: String(result).trim() };
  }
  if (cell.type === ExcelJS.ValueType.Number) return { text: formatNumber(cell.value as number, cell.numFmt) };
  return { text: cell.text.trim() };
}

/**
 * `value` in the first section of an Excel number format: its currency sign
 * and other literal text, decimal places, thousands separator and percent.
 * Padding (`_x`), fills (`*x`), colours and conditions show nothing. `General`
 * is at most ten significant digits, as Excel shows it in a column this wide.
 */
export function formatNumber(value: number, numFmt: string | undefined): string {
  const section = splitSections(numFmt ?? 'General')[0] ?? 'General';
  let shown = '';
  let numberDone = false;
  const percent = /%/.test(section.replace(/"[^"]*"/g, ''));
  const number = percent ? value * 100 : value;

  for (let at = 0; at < section.length; ) {
    const char = section[at] as string;
    if (char === '"') {
      const end = section.indexOf('"', at + 1);
      shown += section.slice(at + 1, end === -1 ? undefined : end);
      at = end === -1 ? section.length : end + 1;
    } else if (char === '[') {
      const end = section.indexOf(']', at);
      const inside = section.slice(at + 1, end === -1 ? undefined : end);
      // `[$$-409]` is a currency sign and a locale; `[Red]` or `[>=100]` shows nothing.
      if (inside.startsWith('$')) shown += inside.slice(1).split('-')[0];
      at = end === -1 ? section.length : end + 1;
    } else if (char === '_' || char === '*') {
      at += 2;
    } else if (char === '\\') {
      shown += section[at + 1] ?? '';
      at += 2;
    } else if (/^general/i.test(section.slice(at))) {
      if (!numberDone) shown += general(number);
      numberDone = true;
      at += 'general'.length;
    } else if (/[0#?.,]/.test(char)) {
      const run = /^[0#?.,]+/.exec(section.slice(at))?.[0] ?? char;
      if (!numberDone && /[0#?]/.test(run)) {
        shown += digits(number, run);
        numberDone = true;
      } else if (numberDone && /[0#?]/.test(run)) {
        // A second number placeholder, as in a fraction: not used by the verified list.
      } else {
        shown += run;
      }
      at += run.length;
    } else if (char === '@') {
      at += 1;
    } else {
      shown += char;
      at += 1;
    }
  }
  if (!numberDone) shown = general(number) + shown;
  return (value < 0 && !shown.includes('-') ? `-${shown}` : shown).trim();
}

function splitSections(numFmt: string): string[] {
  const sections: string[] = [];
  let current = '';
  let quoted = false;
  for (const char of numFmt) {
    if (char === '"') quoted = !quoted;
    if (char === ';' && !quoted) {
      sections.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  sections.push(current);
  return sections;
}

/** `|value|` with as many decimals as `pattern` has after its point, and thousands separators if it has a comma. */
function digits(value: number, pattern: string): string {
  const point = pattern.indexOf('.');
  const decimals = point === -1 ? 0 : (pattern.slice(point + 1).match(/[0#?]/g) ?? []).length;
  const thousands = (point === -1 ? pattern : pattern.slice(0, point)).includes(',');
  const fixed = Math.abs(value).toFixed(decimals);
  if (!thousands) return fixed;
  const [whole = '', fraction] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}

function general(value: number): string {
  return String(Math.abs(Number(value.toPrecision(10))));
}
