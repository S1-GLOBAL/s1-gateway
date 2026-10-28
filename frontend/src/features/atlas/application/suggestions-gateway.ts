import type { SlotKey } from '../domain/atlas';
import type { ApprovedChange, Suggestion, SuggestionDetail, SuggestionInput } from '../domain/suggestion';

/**
 * Where the Atlas feature suggests, reads and decides dictionary changes (#95,
 * ADR 0031). The application owns this port; infrastructure implements it over
 * HTTP. Every method rejects with an AppError: a refused approval carries the
 * server's own message, a reason that is missing or too long carries it under
 * `fields.reason`, and a suggestion's problems arrive under the field each is
 * about (`code`, `newCode`, `meaning`, `searchWords`, `replacement`, `rules`).
 */
export interface SuggestionsGateway {
  /** Suggests a change. Nothing in the dictionary changes until an admin approves it. */
  suggest(input: SuggestionInput): Promise<Suggestion>;
  /** The suggester only, while it waits: replaces what it asks for, from the `version` they read. */
  edit(id: string, input: SuggestionInput & { version: number }): Promise<Suggestion>;
  /** How many saved Spec IDs hold an option. */
  usage(slot: SlotKey, code: string): Promise<number>;
  /** Waiting suggestions oldest first; decided ones latest decision first. */
  list(state: 'waiting' | 'decided'): Promise<Suggestion[]>;
  /** One suggestion with its trail, its option's use, and while it waits what approving would rewrite. */
  get(id: string): Promise<SuggestionDetail>;
  /** How many waiting suggestions the signed-in person may decide: 0 for staff. */
  waitingCount(): Promise<number>;
  /** Admins only: approves the `version` the approver read. */
  approve(id: string, version: number): Promise<ApprovedChange>;
  /** Admins only: rejects with a reason the suggester sees. */
  reject(id: string, reason: string): Promise<Suggestion>;
  /** The suggester only, while it waits. */
  withdraw(id: string): Promise<Suggestion>;
}
