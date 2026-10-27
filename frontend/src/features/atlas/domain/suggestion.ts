import type { SlotKey, SlotRule, Staff } from './atlas';

/*
 * Suggested changes to the Atlas dictionary (#95, ADR 0031): what one asks
 * for, its trail, and the words people read about it. Where #95's copy table
 * words a line, it is worded exactly so.
 */

export type SuggestionKind = 'add' | 'edit' | 'delete' | 'rules';
export type SuggestionState = 'waiting' | 'approved' | 'rejected' | 'withdrawn';

/** What a suggestion asks for, by kind. */
export type Proposal =
  | { kind: 'add'; meaning: string; searchWords: readonly string[]; rules: Readonly<Partial<Record<SlotKey, SlotRule>>> | null }
  | { kind: 'edit'; newCode: string | null; meaning: string | null; searchWords: readonly string[] | null }
  | { kind: 'delete'; replacement: string | null }
  | { kind: 'rules'; rules: Readonly<Partial<Record<SlotKey, SlotRule>>> };

export interface Suggestion {
  id: string;
  kind: SuggestionKind;
  /** The dictionary list it is about. */
  slot: SlotKey;
  /** The option it is about: the new code for an add, the product type for a rules change. */
  code: string;
  proposal: Proposal;
  state: SuggestionState;
  /** Raised on each edit; an approval names the one the approver read. */
  version: number;
  suggestedBy: Staff;
  suggestedAt: Date;
  /** Who approved or rejected it. */
  decidedBy: Staff | null;
  /** When it was approved, rejected or withdrawn. */
  decidedAt: Date | null;
  /** Why it was rejected. */
  reason: string | null;
  /** The dictionary change it became, once approved. */
  changeNumber: number | null;
}

export interface SuggestionEvent {
  kind: 'suggested' | 'edited' | 'withdrawn' | 'approved' | 'rejected';
  by: Staff;
  at: Date;
  /** An edit's proposal before it. */
  proposalBefore: Proposal | null;
  /** What a suggestion or an edit asks for. */
  proposalAfter: Proposal | null;
  /** A rejection's reason. */
  reason: string | null;
}

/** A saved Spec ID approving would rewrite, with its code now and after. */
export interface Rewrite {
  id: string;
  name: string;
  codeBefore: string;
  codeAfter: string;
}

/** One suggestion with its whole trail and its option's use today. */
export interface SuggestionDetail extends Suggestion {
  /** First step first. */
  events: SuggestionEvent[];
  /** How many saved Spec IDs hold the option now. */
  usage: number;
  /** While it waits: each saved Spec ID approving now would rewrite; null once decided, or when approving would be refused. */
  rewrites: Rewrite[] | null;
  /** While it waits: why approving now would be refused, in the server's words; else null. */
  problem: string | null;
}

/** An approval's answer. */
export interface ApprovedChange {
  suggestion: Suggestion;
  changeNumber: number;
  specIdsRewritten: number;
}

/** `1 saved Spec ID`, `3 saved Spec IDs`. */
export function savedSpecIds(count: number): string {
  return count === 1 ? '1 saved Spec ID' : `${count} saved Spec IDs`;
}

/** Where a suggestion stands, in #95's words. A waiting one reads as its suggester sees it. */
export function stateLine(suggestion: Suggestion): string {
  const decider = suggestion.decidedBy?.fullName ?? 'an admin';
  switch (suggestion.state) {
    case 'waiting':
      return 'Waiting for an admin';
    case 'approved':
      return `Approved as change #${suggestion.changeNumber ?? '?'} by ${decider}`;
    case 'rejected':
      return `Rejected by ${decider}: ${suggestion.reason ?? ''}`;
    case 'withdrawn':
      return 'Withdrawn';
  }
}

/** #95's line once an approval succeeds: "Change #4 is live. 3 saved Spec IDs were updated." */
export function approvedLine(approved: ApprovedChange): string {
  const updated = approved.specIdsRewritten === 1 ? 'was updated' : 'were updated';
  return `Change #${approved.changeNumber} is live. ${savedSpecIds(approved.specIdsRewritten)} ${updated}.`;
}

/** Whether approving can rewrite saved Spec IDs: a new code, a deletion, or a product type's rules. */
export function rewritesSpecIds(proposal: Proposal): boolean {
  return (proposal.kind === 'edit' && proposal.newCode !== null) || proposal.kind === 'delete' || proposal.kind === 'rules';
}

/**
 * How many saved Spec IDs hold the option, in #95's words when approving
 * would change them; null when none does.
 */
export function usageLine(usage: number, proposal: Proposal): string | null {
  if (usage === 0) return null;
  if (!rewritesSpecIds(proposal)) return `Used by ${savedSpecIds(usage)}.`;
  return `Used by ${savedSpecIds(usage)}. If approved, ${usage === 1 ? 'it changes' : 'they change'} too.`;
}

/** Who may do what with a suggestion: the one who made it, or an admin who did not. */
export interface SuggestionActions {
  withdraw: boolean;
  decide: boolean;
}

export function actionsFor(suggestion: Suggestion, viewer: { id: string; isAdmin: boolean }): SuggestionActions {
  const waiting = suggestion.state === 'waiting';
  const own = suggestion.suggestedBy.id === viewer.id;
  return { withdraw: waiting && own, decide: waiting && !own && viewer.isAdmin };
}
