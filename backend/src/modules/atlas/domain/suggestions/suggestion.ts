import { err, ok, type Result } from '../../../../shared/domain/result.js';
import type { Proposal, SuggestionKind, SuggestionTarget } from './proposal.js';
import { OwnSuggestionError, SuggestionDecidedError, SuggestionNotAllowedError } from './suggestion.errors.js';

export type SuggestionState = 'waiting' | 'approved' | 'rejected' | 'withdrawn';

export type SuggestionEventKind = 'suggested' | 'edited' | 'withdrawn' | 'approved' | 'rejected';

/** One step in a suggestion's trail. Only ever recorded, never changed (#95). */
export interface SuggestionEvent {
  readonly id: string;
  readonly suggestionId: string;
  readonly kind: SuggestionEventKind;
  /** The account that took the step. */
  readonly by: string;
  readonly at: Date;
  /** `edited` only: what it asked for before. */
  readonly proposalBefore: Proposal | null;
  /** `suggested` and `edited`: what it asks for now. */
  readonly proposalAfter: Proposal | null;
  /** `rejected` only. */
  readonly reason: string | null;
}

export interface SuggestionProps {
  readonly id: string;
  readonly target: SuggestionTarget;
  readonly proposal: Proposal;
  readonly state: SuggestionState;
  /** 1 when suggested; raised by 1 on every edit, so an approval decides what the approver saw. */
  readonly version: number;
  readonly suggestedBy: string;
  readonly suggestedAt: Date;
  /** Who approved or rejected it; null while it waits, and when withdrawn. */
  readonly decidedBy: string | null;
  /** When it was approved, rejected or withdrawn. */
  readonly decidedAt: Date | null;
  readonly reason: string | null;
  /** The dictionary change it became, once approved. */
  readonly changeNumber: number | null;
}

/** A step taken: the suggestion as it now is, and the event to record. */
export interface SuggestionStep {
  readonly suggestion: Suggestion;
  readonly event: SuggestionEvent;
}

/**
 * A change to the dictionary someone asked for (#95, ADR 0031). Nothing in the
 * dictionary changes until an admin who did not suggest it approves it. Its
 * target and proposal are checked by `checkProposal` before it is made or edited.
 */
export class Suggestion {
  private constructor(private readonly props: SuggestionProps) {}

  static suggest(input: {
    id: string;
    eventId: string;
    target: SuggestionTarget;
    proposal: Proposal;
    by: string;
    at: Date;
  }): SuggestionStep {
    const suggestion = new Suggestion({
      id: input.id,
      target: input.target,
      proposal: input.proposal,
      state: 'waiting',
      version: 1,
      suggestedBy: input.by,
      suggestedAt: input.at,
      decidedBy: null,
      decidedAt: null,
      reason: null,
      changeNumber: null,
    });
    return {
      suggestion,
      event: suggestion.event(input.eventId, 'suggested', input.by, input.at, { after: input.proposal }),
    };
  }

  /** Rebuilds a suggestion that was valid when it was stored. For persistence only. */
  static restore(props: SuggestionProps): Suggestion {
    return new Suggestion(props);
  }

  get id(): string {
    return this.props.id;
  }

  get kind(): SuggestionKind {
    return this.props.proposal.kind;
  }

  get target(): SuggestionTarget {
    return this.props.target;
  }

  get proposal(): Proposal {
    return this.props.proposal;
  }

  get state(): SuggestionState {
    return this.props.state;
  }

  get version(): number {
    return this.props.version;
  }

  get suggestedBy(): string {
    return this.props.suggestedBy;
  }

  get suggestedAt(): Date {
    return this.props.suggestedAt;
  }

  get decidedBy(): string | null {
    return this.props.decidedBy;
  }

  get decidedAt(): Date | null {
    return this.props.decidedAt;
  }

  get reason(): string | null {
    return this.props.reason;
  }

  get changeNumber(): number | null {
    return this.props.changeNumber;
  }

  /** The suggester replaces what it asks for while it waits; the edit is kept with what it said before. */
  edit(
    by: string,
    proposal: Proposal,
    at: Date,
    eventId: string,
  ): Result<SuggestionStep, SuggestionNotAllowedError | SuggestionDecidedError> {
    const refused = this.refusalFor(by);
    if (refused) return err(refused);
    const suggestion = new Suggestion({ ...this.props, proposal, version: this.version + 1 });
    return ok({
      suggestion,
      event: this.event(eventId, 'edited', by, at, { before: this.proposal, after: proposal }),
    });
  }

  /** The suggester takes it back while it waits. */
  withdraw(
    by: string,
    at: Date,
    eventId: string,
  ): Result<SuggestionStep, SuggestionNotAllowedError | SuggestionDecidedError> {
    const refused = this.refusalFor(by);
    if (refused) return err(refused);
    const suggestion = new Suggestion({ ...this.props, state: 'withdrawn', decidedAt: at });
    return ok({ suggestion, event: this.event(eventId, 'withdrawn', by, at, {}) });
  }

  /**
   * An admin who did not suggest it approves it, as dictionary change
   * `changeNumber` (#95). That the approver is an admin is the route's gate.
   */
  approve(
    by: string,
    at: Date,
    eventId: string,
    changeNumber: number,
  ): Result<SuggestionStep, OwnSuggestionError | SuggestionDecidedError> {
    const refused = this.decisionRefusalFor(by);
    if (refused) return err(refused);
    const suggestion = new Suggestion({ ...this.props, state: 'approved', decidedBy: by, decidedAt: at, changeNumber });
    return ok({ suggestion, event: this.event(eventId, 'approved', by, at, {}) });
  }

  /** An admin who did not suggest it rejects it, saying why: `reason` is already checked. */
  reject(
    by: string,
    reason: string,
    at: Date,
    eventId: string,
  ): Result<SuggestionStep, OwnSuggestionError | SuggestionDecidedError> {
    const refused = this.decisionRefusalFor(by);
    if (refused) return err(refused);
    const suggestion = new Suggestion({ ...this.props, state: 'rejected', decidedBy: by, decidedAt: at, reason });
    return ok({ suggestion, event: { ...this.event(eventId, 'rejected', by, at, {}), reason } });
  }

  /** Why `by` may not approve or reject it now, or null when they may. */
  decisionRefusalFor(by: string): OwnSuggestionError | SuggestionDecidedError | null {
    if (by === this.suggestedBy) return new OwnSuggestionError();
    if (this.state !== 'waiting') return new SuggestionDecidedError();
    return null;
  }

  /** Why `by` may not edit or withdraw it now, or null when they may. */
  refusalFor(by: string): SuggestionNotAllowedError | SuggestionDecidedError | null {
    if (by !== this.suggestedBy) return new SuggestionNotAllowedError();
    if (this.state !== 'waiting') return new SuggestionDecidedError();
    return null;
  }

  private event(
    id: string,
    kind: SuggestionEventKind,
    by: string,
    at: Date,
    proposals: { before?: Proposal; after?: Proposal },
  ): SuggestionEvent {
    return {
      id,
      suggestionId: this.id,
      kind,
      by,
      at,
      proposalBefore: proposals.before ?? null,
      proposalAfter: proposals.after ?? null,
      reason: null,
    };
  }
}
