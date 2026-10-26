import type { DictionarySlotKey } from '../domain/slots.js';
import { Suggestion, type SuggestionEvent, type SuggestionEventKind, type SuggestionState } from '../domain/suggestions/suggestion.js';
import type { atlasDictionarySuggestionEvents } from './atlas-dictionary-suggestion-events.table.js';
import type { atlasDictionarySuggestions } from './atlas-dictionary-suggestions.table.js';

type SuggestionRow = typeof atlasDictionarySuggestions.$inferSelect;
type NewSuggestionRow = typeof atlasDictionarySuggestions.$inferInsert;
type EventRow = typeof atlasDictionarySuggestionEvents.$inferSelect;
type NewEventRow = typeof atlasDictionarySuggestionEvents.$inferInsert;

export function toSuggestion(row: SuggestionRow): Suggestion {
  return Suggestion.restore({
    id: row.id,
    target: { slot: row.slot as DictionarySlotKey, code: row.code },
    proposal: row.proposal,
    state: row.state as SuggestionState,
    version: row.version,
    suggestedBy: row.suggestedBy,
    suggestedAt: row.suggestedAt,
    decidedBy: row.decidedBy,
    decidedAt: row.decidedAt,
    reason: row.reason,
    changeNumber: row.changeNumber,
  });
}

export function toSuggestionRow(suggestion: Suggestion): NewSuggestionRow {
  return {
    id: suggestion.id,
    kind: suggestion.kind,
    slot: suggestion.target.slot,
    code: suggestion.target.code,
    proposal: suggestion.proposal,
    state: suggestion.state,
    version: suggestion.version,
    suggestedBy: suggestion.suggestedBy,
    suggestedAt: suggestion.suggestedAt,
    decidedBy: suggestion.decidedBy,
    decidedAt: suggestion.decidedAt,
    reason: suggestion.reason,
    changeNumber: suggestion.changeNumber,
  };
}

export function toEvent(row: EventRow): SuggestionEvent {
  return {
    id: row.id,
    suggestionId: row.suggestionId,
    kind: row.kind as SuggestionEventKind,
    by: row.by,
    at: row.at,
    proposalBefore: row.proposalBefore,
    proposalAfter: row.proposalAfter,
    reason: row.reason,
  };
}

export function toEventRow(event: SuggestionEvent): NewEventRow {
  return { ...event };
}
