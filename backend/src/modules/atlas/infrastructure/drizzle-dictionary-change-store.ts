import { and, eq } from 'drizzle-orm';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import type { Database } from '../../../shared/infrastructure/database/connection.js';
import { isUniqueViolation } from '../../../shared/infrastructure/database/postgres-errors.js';
import type {
  DictionaryChangeError,
  DictionaryChangePlan,
  DictionaryChangeStore,
  OptionHolders,
} from '../domain/suggestions/dictionary-change-store.js';
import {
  DictionaryMovedOnError,
  SpecIdMovedOnError,
  SpecIdsWouldClashError,
  SuggestionChangedError,
} from '../domain/suggestions/suggestion.errors.js';
import { atlasDictionaryChanges } from './atlas-dictionary-changes.table.js';
import { atlasDictionarySuggestionEvents } from './atlas-dictionary-suggestion-events.table.js';
import { atlasDictionarySuggestions } from './atlas-dictionary-suggestions.table.js';
import {
  atlasDictionaryRenames,
  atlasDictionarySearchWords,
  atlasDictionaryValues,
  atlasSlotRules,
} from './atlas-dictionary.table.js';
import { atlasSpecIdChanges } from './atlas-spec-id-changes.table.js';
import { atlasSpecIds } from './atlas-spec-ids.table.js';
import { lockDictionaryAlone } from './dictionary-change-lock.js';
import { toRuleRows, toValueRows } from './dictionary.mapper.js';
import { holdsOption } from './drizzle-spec-id-repository.js';
import { toChangeRow, toRow } from './saved-spec-id.mapper.js';
import { toEventRow, toSuggestionRow } from './suggestion.mapper.js';

/** Thrown inside the transaction to roll it back, carrying the reason. */
class Refused extends Error {
  constructor(readonly reason: DictionaryChangeError) {
    super(reason.message);
  }
}

/**
 * The one writer of the dictionary. An approval writes the whole next
 * release, its renames and search words, the numbered change, the approved
 * suggestion, and every Spec ID it rewrites with its history entry, in one
 * transaction, or nothing. Approvals are rare and the release is about 800
 * rows, so it is written whole rather than row by row. It holds the
 * dictionary lock alone, so no Spec ID is saved or changed meanwhile.
 */
export class DrizzleDictionaryChangeStore implements DictionaryChangeStore {
  constructor(private readonly db: Database) {}

  async apply(plan: DictionaryChangePlan): Promise<Result<void, DictionaryChangeError>> {
    try {
      await this.db.transaction(async (tx) => {
        if ((await lockDictionaryAlone(tx)) !== plan.basedOn) throw new Refused(new DictionaryMovedOnError());
        // A Spec ID saved with the option, changed to or from it, or changed at all since the plan read it.
        if (plan.holders && !(await sameHolders(tx, plan.holders))) throw new Refused(new SpecIdMovedOnError());

        const { release } = plan.dictionary;
        await tx.delete(atlasDictionaryValues).where(eq(atlasDictionaryValues.release, release));
        await tx.insert(atlasDictionaryValues).values(toValueRows(plan.dictionary));
        await tx.delete(atlasSlotRules).where(eq(atlasSlotRules.release, release));
        await tx.insert(atlasSlotRules).values(toRuleRows(plan.dictionary));

        await tx.insert(atlasDictionaryChanges).values({
          number: plan.change.number,
          suggestionId: plan.change.suggestionId,
          approvedBy: plan.change.approvedBy,
          approvedAt: plan.change.approvedAt,
          specIdsRewritten: plan.rewrites.length,
        });

        // Renames and search words name the change that made them, so they come after it.
        const renames = plan.dictionary.renames();
        await tx.delete(atlasDictionaryRenames);
        if (renames.length > 0) await tx.insert(atlasDictionaryRenames).values(renames);
        const words = plan.dictionary.searchWords();
        await tx.delete(atlasDictionarySearchWords);
        if (words.length > 0) await tx.insert(atlasDictionarySearchWords).values(words);

        const approved = await tx
          .update(atlasDictionarySuggestions)
          .set(toSuggestionRow(plan.suggestion.suggestion))
          .where(
            and(
              eq(atlasDictionarySuggestions.id, plan.suggestion.suggestion.id),
              eq(atlasDictionarySuggestions.version, plan.suggestionVersion),
              eq(atlasDictionarySuggestions.state, 'waiting'),
            ),
          )
          .returning({ id: atlasDictionarySuggestions.id });
        if (approved.length === 0) throw new Refused(new SuggestionChangedError());
        await tx.insert(atlasDictionarySuggestionEvents).values(toEventRow(plan.suggestion.event));

        for (const rewrite of plan.rewrites) {
          const updated = await tx
            .update(atlasSpecIds)
            .set(toRow(rewrite.saved))
            .where(and(eq(atlasSpecIds.id, rewrite.saved.id), eq(atlasSpecIds.version, rewrite.expectedVersion)))
            .returning({ id: atlasSpecIds.id });
          if (updated.length === 0) throw new Refused(new SpecIdMovedOnError());
          await tx.insert(atlasSpecIdChanges).values(toChangeRow(rewrite.change));
        }
      });
      return ok(undefined);
    } catch (error) {
      if (error instanceof Refused) return err(error.reason);
      // The unique code index is the last guard: the use case checks for a clash first.
      if (isUniqueViolation(error)) return err(new SpecIdsWouldClashError());
      throw error;
    }
  }
}

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/** Whether the Spec IDs holding the option are still exactly those the plan read, at the versions it read. */
async function sameHolders(tx: Transaction, holders: OptionHolders): Promise<boolean> {
  const now = await tx
    .select({ id: atlasSpecIds.id, version: atlasSpecIds.version })
    .from(atlasSpecIds)
    .where(holdsOption(holders.slot, holders.code));
  const read = new Map(holders.specIds.map(({ id, version }) => [id, version]));
  return now.length === read.size && now.every(({ id, version }) => read.get(id) === version);
}
