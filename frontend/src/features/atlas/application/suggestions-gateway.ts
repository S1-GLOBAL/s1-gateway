import type { ApprovedChange, Suggestion, SuggestionDetail } from '../domain/suggestion';

/**
 * Where the Atlas feature reads and decides suggested dictionary changes (#95,
 * ADR 0031). The application owns this port; infrastructure implements it over
 * HTTP. Every method rejects with an AppError: a refused approval carries the
 * server's own message, and a reason that is missing or too long carries it
 * under `fields.reason`.
 */
export interface SuggestionsGateway {
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
