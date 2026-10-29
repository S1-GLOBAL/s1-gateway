import type { Clock } from '../../../shared/application/ports/clock.js';
import type { IdGenerator } from '../../../shared/application/ports/id-generator.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { buildKeepingWhatFits } from '../domain/build-keeping-what-fits.js';
import type { DictionaryRepository } from '../domain/dictionary-repository.js';
import { QUOTE_COLUMNS, readVerifiedRow, type RowReading, type VerifiedRow } from '../domain/import/verified-row.js';
import { CURRENT_RELEASE, slotDefinition } from '../domain/slots.js';
import { manufacturerKey } from '../domain/sourcing/manufacturer.js';
import type { QuoteValues } from '../domain/sourcing/quote.js';
import type { QuoteToRecord, SourcingRepository } from '../domain/sourcing/sourcing-repository.js';
import type { SpecIdFactsInput } from '../domain/spec-id.js';
import type { SpecIdRepository } from '../domain/spec-id-repository.js';
import type { ImportReportRow, ImportReportSink, ImportSummary, RowOutcome } from './ports/import-report-sink.js';
import type { VerifiedListSource } from './ports/verified-list-source.js';
import type { SaveSpecId } from './save-spec-id.js';

export interface ImportVerifiedListInput {
  /** Saves nothing unless true: a dry run reports what it would do. */
  readonly write: boolean;
  /** The staff account recorded as having saved each Spec ID. */
  readonly savedBy: { readonly id: string; readonly fullName: string };
}

const NAME_CUT = 'Item name cut to 120 characters';

/** A row read into a code, with what the report says about it. */
interface Coded {
  readonly row: VerifiedRow;
  readonly reading: Extract<RowReading, { kind: 'read' }>;
  readonly code: string;
  readonly facts: Partial<SpecIdFactsInput>;
  readonly dropped: readonly string[];
}

/**
 * Imports the verified list (#28, #56, plan 0006): reads each row, builds its
 * code, groups rows with one code into one Spec ID named by the item name
 * most of them use, and, only when writing, saves each new one through
 * `SaveSpecId`. A code already saved is left as it is. Every row imported
 * that names its manufacturer gives a quote for its Spec ID; when writing,
 * they replace the quotes recorded before (ADR 0027). Writes #28's report.
 */
export class ImportVerifiedList implements UseCase<ImportVerifiedListInput, ImportSummary> {
  constructor(
    private readonly dictionaries: DictionaryRepository,
    private readonly specIds: SpecIdRepository,
    private readonly sourcing: SourcingRepository,
    private readonly save: SaveSpecId,
    private readonly source: VerifiedListSource,
    private readonly report: ImportReportSink,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: ImportVerifiedListInput): Promise<ImportSummary> {
    const dictionary = await this.dictionaries.get(CURRENT_RELEASE);
    if (!dictionary) throw new Error(`Dictionary ${CURRENT_RELEASE} is missing`);

    const rows = await this.source.rows();
    const lines = new Map<number, ImportReportRow>();
    const groups = new Map<string, Coded[]>();
    let agreed = 0;
    let compared = 0;

    for (const row of rows) {
      const reading = readVerifiedRow(row, dictionary);
      if (reading.agreement !== null) {
        compared += 1;
        if (reading.agreement) agreed += 1;
      }
      if (reading.kind === 'skipped') {
        lines.set(row.row, skippedLine(row, reading.reason, reading.nameCut, reading.notes));
        continue;
      }
      const build = buildKeepingWhatFits(reading.facts, dictionary);
      if (!build.specId) {
        lines.set(row.row, skippedLine(row, `${reading.facts.productType} is not a product type in ${dictionary.release}.`, reading.nameCut, reading.notes));
        continue;
      }
      const dropped = build.dropped.map(({ key, reasons }) => `${slotDefinition(key).name}: ${reasons.join(' ')}`);
      const coded: Coded = { row, reading, code: build.specId.code, facts: build.facts, dropped };
      groups.set(coded.code, [...(groups.get(coded.code) ?? []), coded]);
    }

    const importedAt = this.clock.now();
    const manufacturerIds = new Map<string, string>();
    const quotes: QuoteToRecord[] = [];
    let quoted = 0;
    let created = 0;
    let alreadySaved = 0;
    for (const [code, members] of groups) {
      const [first] = members as [Coded, ...Coded[]];
      let specId = (await this.specIds.findByCode(code))?.savedSpecId.id ?? null;
      const saved = specId !== null;
      if (!saved && input.write) {
        const result = await this.save.execute({ name: nameOf(members), facts: first.facts as SpecIdFactsInput, savedBy: input.savedBy });
        if (result.ok) specId = result.value.id;
        // Saved by someone else since it was looked up: it is that Spec ID the quotes belong to.
        else if (result.error.code === 'SPEC_ID_EXISTS') specId = (await this.specIds.findByCode(code))?.savedSpecId.id ?? null;
        else throw new Error(`Row ${first.row.row} could not be saved: ${result.error.message}`);
      }
      if (saved) alreadySaved += 1;
      else created += 1;
      for (const member of members) {
        const outcome: RowOutcome = saved ? 'already saved' : member === first ? 'new' : `same as row ${first.row.row}`;
        const company = member.row.company.trim();
        // A dry run has no id for a Spec ID it would create, but would record the quote all the same.
        const recorded = company !== '' && (specId !== null || !input.write);
        if (recorded) {
          quoted += 1;
          const key = manufacturerKey(company);
          if (!manufacturerIds.has(key)) manufacturerIds.set(key, this.ids.next());
          if (specId !== null) {
            quotes.push({
              id: this.ids.next(),
              specId,
              manufacturer: { id: manufacturerIds.get(key) as string, name: company, country: orNull(member.row.country) },
              values: quoteOf(member.row),
              importedAt,
            });
          }
        }
        lines.set(member.row.row, {
          row: member.row.row,
          itemName: member.row.itemName,
          outcome,
          code,
          reason: null,
          readFromRow: [...member.reading.readFromRow],
          dropped: member.dropped,
          manufacturer: company === '' ? 'no manufacturer' : 'found',
          quote: recorded ? 'recorded' : 'not recorded',
          flags: flagsOf(member.row, member.reading.nameCut, member.reading.notes),
        });
      }
    }
    if (input.write) await this.sourcing.replaceQuotes(quotes);

    const summary: ImportSummary = {
      rows: rows.length,
      created,
      sameAs: [...lines.values()].filter((entry) => entry.outcome.startsWith('same as row')).length,
      alreadySaved,
      skipped: [...lines.values()].filter((entry) => entry.outcome === 'skipped').length,
      manufacturers: manufacturerIds.size,
      quotes: quoted,
      agreement: { agreed, compared },
    };
    await this.report.write({ summary, rows: rows.map((row) => lines.get(row.row)).filter((entry) => entry !== undefined) });
    return summary;
  }
}

/** A row not imported: it records no quote (#56). */
function skippedLine(row: VerifiedRow, reason: string, nameCut: boolean, notes: readonly string[]): ImportReportRow {
  return {
    row: row.row,
    itemName: row.itemName,
    outcome: 'skipped',
    code: null,
    reason,
    readFromRow: [],
    dropped: [],
    manufacturer: row.company.trim() === '' ? 'no manufacturer' : 'found',
    quote: 'not recorded',
    flags: flagsOf(row, nameCut, notes),
  };
}

/** A name cut to fit, a quote formula with no saved value, and the reader's notes on the row. */
function flagsOf(row: VerifiedRow, nameCut: boolean, notes: readonly string[]): string[] {
  return [
    ...(nameCut ? [NAME_CUT] : []),
    ...notes,
    ...row.unsavedFormulas.map((column) => `${QUOTE_COLUMNS[column]}: a formula with no value saved in the workbook`),
  ];
}

function orNull(text: string): string | null {
  const trimmed = text.trim();
  return trimmed === '' ? null : trimmed;
}

/** The row's quote, each value as the workbook shows it (ADR 0027). */
function quoteOf(row: VerifiedRow): QuoteValues {
  return {
    itemName: orNull(row.itemName),
    fobPerUnit: orNull(row.quote.fobPerUnit),
    fobPerCase: orNull(row.quote.fobPerCase),
    fobTotal: orNull(row.quote.fobTotal),
    moldCost: orNull(row.quote.moldCost),
    moldLeadTime: orNull(row.quote.moldLeadTime),
    sampleLeadTime: orNull(row.quote.sampleLeadTime),
    productionLeadTime: orNull(row.quote.productionLeadTime),
  };
}

/** The item name most of the rows use; the first row's breaks a tie (#28). */
function nameOf(members: readonly Coded[]): string {
  const counts = new Map<string, number>();
  for (const { reading } of members) counts.set(reading.name, (counts.get(reading.name) ?? 0) + 1);
  let best = members[0]?.reading.name ?? '';
  for (const { reading } of members) if ((counts.get(reading.name) ?? 0) > (counts.get(best) ?? 0)) best = reading.name;
  return best;
}
