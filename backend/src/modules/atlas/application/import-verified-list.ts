import type { UseCase } from '../../../shared/application/use-case.js';
import { buildKeepingWhatFits } from '../domain/build-keeping-what-fits.js';
import type { Dictionary } from '../domain/dictionary.js';
import type { DictionaryRepository } from '../domain/dictionary-repository.js';
import { readVerifiedRow, type RowNote, type RowReading } from '../domain/import/verified-row.js';
import { CURRENT_RELEASE, slotDefinition } from '../domain/slots.js';
import { meaningOfFact, type SpecIdFactsInput } from '../domain/spec-id.js';
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
  readonly reading: Extract<RowReading, { kind: 'read' }>;
  readonly itemName: string;
  readonly code: string;
  readonly facts: Partial<SpecIdFactsInput>;
  readonly dropped: readonly string[];
}

/**
 * Imports the verified list (#28, plan 0006): reads each row, builds its
 * code, groups rows with one code into one Spec ID named by the item name
 * most of them use, and, only when writing, saves each new one through
 * `SaveSpecId`. A code already saved is left as it is. Writes #28's report.
 */
export class ImportVerifiedList implements UseCase<ImportVerifiedListInput, ImportSummary> {
  constructor(
    private readonly dictionaries: DictionaryRepository,
    private readonly specIds: SpecIdRepository,
    private readonly save: SaveSpecId,
    private readonly source: VerifiedListSource,
    private readonly report: ImportReportSink,
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
      const flags = reading.nameCut ? [NAME_CUT] : [];
      if (reading.kind === 'skipped') {
        lines.set(row.row, line(row.row, row.itemName, 'skipped', null, reading.reason, [], [], flags));
        continue;
      }
      const build = buildKeepingWhatFits(reading.facts, dictionary);
      if (!build.specId) {
        lines.set(row.row, line(row.row, row.itemName, 'skipped', null, `${reading.facts.productType} is not a product type in ${dictionary.release}.`, [], [], flags));
        continue;
      }
      const dropped = build.dropped.map(({ key, reasons }) => `${slotDefinition(key).name}: ${reasons.join(' ')}`);
      const coded: Coded = { reading, itemName: row.itemName, code: build.specId.code, facts: build.facts, dropped };
      groups.set(coded.code, [...(groups.get(coded.code) ?? []), coded]);
    }

    let created = 0;
    let alreadySaved = 0;
    for (const [code, members] of groups) {
      const [first] = members as [Coded, ...Coded[]];
      let saved = (await this.specIds.findByCode(code)) !== null;
      if (!saved && input.write) {
        const result = await this.save.execute({ name: nameOf(members), facts: first.facts as SpecIdFactsInput, savedBy: input.savedBy });
        // Saved by someone else since it was looked up: it is already saved, as far as this run goes.
        if (!result.ok && result.error.code === 'SPEC_ID_EXISTS') saved = true;
        else if (!result.ok) throw new Error(`Row ${first.reading.row} could not be saved: ${result.error.message}`);
      }
      if (saved) alreadySaved += 1;
      else created += 1;
      for (const member of members) {
        const outcome: RowOutcome = saved ? 'already saved' : member === first ? 'new' : `same as row ${first.reading.row}`;
        lines.set(
          member.reading.row,
          line(
            member.reading.row,
            member.itemName,
            outcome,
            code,
            null,
            notesOf(member.reading, member.facts, dictionary),
            member.dropped,
            member.reading.nameCut ? [NAME_CUT] : [],
          ),
        );
      }
    }

    const summary: ImportSummary = {
      rows: rows.length,
      created,
      alreadySaved,
      skipped: [...lines.values()].filter((entry) => entry.outcome === 'skipped').length,
      agreement: { agreed, compared },
    };
    await this.report.write({ summary, rows: rows.map((row) => lines.get(row.row)).filter((entry) => entry !== undefined) });
    return summary;
  }
}

function line(
  row: number,
  itemName: string,
  outcome: RowOutcome,
  code: string | null,
  reason: string | null,
  readFromRow: readonly string[],
  dropped: readonly string[],
  flags: readonly string[],
): ImportReportRow {
  return { row, itemName, outcome, code, reason, readFromRow, dropped, flags };
}

/** The item name most of the rows use; the first row's breaks a tie (#28). */
function nameOf(members: readonly Coded[]): string {
  const counts = new Map<string, number>();
  for (const { reading } of members) counts.set(reading.name, (counts.get(reading.name) ?? 0) + 1);
  let best = members[0]?.reading.name ?? '';
  for (const { reading } of members) if ((counts.get(reading.name) ?? 0) > (counts.get(best) ?? 0)) best = reading.name;
  return best;
}

/** Each fact read from the item name or under a ruling, as the report lists it, if the build kept it. */
function notesOf(reading: Extract<RowReading, { kind: 'read' }>, kept: Partial<SpecIdFactsInput>, dictionary: Dictionary): string[] {
  const notes: RowNote[] = [...reading.fromItemName, ...reading.underRuling.filter((note) => !reading.fromItemName.includes(note))];
  const facts = kept as Record<string, unknown>;
  return notes
    .filter((note) => facts[note.key] !== undefined && facts[note.key] !== null)
    .map((note) => {
      const fact = facts[note.key] as Parameters<typeof meaningOfFact>[1];
      const meaning = meaningOfFact(note.key, fact, dictionary) ?? note.words;
      return `${slotDefinition(note.key).name}: ${meaning}${note.ruling ? ` (${note.ruling}, from "${note.words}")` : ''}`;
    });
}
