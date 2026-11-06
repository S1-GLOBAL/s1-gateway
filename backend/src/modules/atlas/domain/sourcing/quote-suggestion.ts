import { err, ok, type Result } from '../../../../shared/domain/result.js';
import type { QuoteValues } from './quote.js';
import {
  InvalidQuoteSuggestionError,
  OwnQuoteSuggestionError,
  QuoteSuggestionDecidedError,
  QuoteSuggestionNotAllowedError,
  type QuoteSuggestionIssues,
} from './quote-suggestion.errors.js';

/** The manufacturer a quotation is from: one already in Atlas, or a new one, made only when it is approved. */
export type SuggestedManufacturer =
  | { readonly kind: 'existing'; readonly id: string }
  | { readonly kind: 'new'; readonly name: string; readonly country: string | null };

/** What a quotation asks to record: its manufacturer and the quote's values, FOB per unit always among them. */
export interface QuoteProposal {
  readonly manufacturer: SuggestedManufacturer;
  readonly values: QuoteValues;
}

export type QuoteSuggestionState = 'waiting' | 'approved' | 'rejected' | 'withdrawn';

export type QuoteSuggestionEventKind = 'suggested' | 'edited' | 'withdrawn' | 'approved' | 'rejected';

/** One step in a quotation's trail. Only ever recorded, never changed. */
export interface QuoteSuggestionEvent {
  readonly id: string;
  readonly suggestionId: string;
  readonly kind: QuoteSuggestionEventKind;
  /** The account that took the step. */
  readonly by: string;
  readonly at: Date;
  /** `edited` only: what it asked for before. */
  readonly proposalBefore: QuoteProposal | null;
  /** `suggested` and `edited`: what it asks for now. */
  readonly proposalAfter: QuoteProposal | null;
  /** `rejected` only. */
  readonly reason: string | null;
}

export interface QuoteSuggestionProps {
  readonly id: string;
  /** The saved Spec ID it quotes. */
  readonly specId: string;
  readonly proposal: QuoteProposal;
  readonly state: QuoteSuggestionState;
  /** 1 when added; raised by 1 on every edit, so an approval decides what the approver saw. */
  readonly version: number;
  readonly suggestedBy: string;
  readonly suggestedAt: Date;
  /** Who approved or rejected it; null while it waits, and when withdrawn. */
  readonly decidedBy: string | null;
  /** When it was approved, rejected or withdrawn. */
  readonly decidedAt: Date | null;
  readonly reason: string | null;
  /** The quote it became, once approved. */
  readonly quoteId: string | null;
}

/** A step taken: the quotation as it now is, and the event to record. */
export interface QuoteSuggestionStep {
  readonly suggestion: QuoteSuggestion;
  readonly event: QuoteSuggestionEvent;
}

/** The longest a quote's value may be: a price or a lead time as written, with a note. */
export const VALUE_MAX = 200;
export const MANUFACTURER_NAME_MAX = 120;
export const COUNTRY_MAX = 60;

const VALUE_FIELDS = [
  'itemName',
  'fobPerUnit',
  'fobPerCase',
  'fobTotal',
  'moldCost',
  'moldLeadTime',
  'sampleLeadTime',
  'productionLeadTime',
] as const satisfies readonly (keyof QuoteValues)[];

/** A quotation as the form sends it, before it is checked. */
export interface QuoteProposalInput {
  readonly manufacturer: { readonly id?: string | null; readonly name?: string | null; readonly country?: string | null };
  readonly values: Partial<Record<keyof QuoteValues, string | null>>;
}

/** Text trimmed, and nothing when it is empty. */
function tidy(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').replace(/\s+/g, ' ').trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Checks a quotation (ADR 0035): a manufacturer, either one chosen by id or a
 * new one by name, and FOB per unit; every other value optional. Each value
 * is kept as written, trimmed, never read as a number, as an imported quote's
 * is. Whether a chosen manufacturer exists is the use case's to check.
 */
export function checkQuoteProposal(input: QuoteProposalInput): Result<QuoteProposal, InvalidQuoteSuggestionError> {
  const issues: QuoteSuggestionIssues = {};
  const id = tidy(input.manufacturer.id);
  const name = tidy(input.manufacturer.name);
  const country = tidy(input.manufacturer.country);
  let manufacturer: SuggestedManufacturer | null = null;
  if (id !== null && name !== null) {
    issues.manufacturer = ['Choose a manufacturer, or name a new one, not both.'];
  } else if (id !== null) {
    manufacturer = { kind: 'existing', id };
  } else if (name !== null) {
    if (name.length > MANUFACTURER_NAME_MAX) issues.manufacturerName = [`Keep the name to ${MANUFACTURER_NAME_MAX} characters.`];
    if (country !== null && country.length > COUNTRY_MAX) issues.manufacturerCountry = [`Keep the country to ${COUNTRY_MAX} characters.`];
    manufacturer = { kind: 'new', name, country };
  } else {
    issues.manufacturer = ['Choose a manufacturer, or name a new one.'];
  }

  const values = Object.fromEntries(VALUE_FIELDS.map((field) => [field, tidy(input.values[field])])) as Record<keyof QuoteValues, string | null>;
  for (const field of VALUE_FIELDS) {
    const value = values[field];
    if (value !== null && value.length > VALUE_MAX) issues[field] = [`Keep this to ${VALUE_MAX} characters.`];
  }
  if (values.fobPerUnit === null) issues.fobPerUnit = ['Give the FOB price per unit.'];

  if (Object.keys(issues).length > 0 || manufacturer === null) return err(new InvalidQuoteSuggestionError(issues));
  return ok({ manufacturer, values });
}

/**
 * A quotation someone added to a Spec ID (ADR 0035). None of the Spec ID's
 * quotes change until an admin who did not add it approves it. Its proposal
 * is checked by `checkQuoteProposal` before it is made or edited.
 */
export class QuoteSuggestion {
  private constructor(private readonly props: QuoteSuggestionProps) {}

  static suggest(input: { id: string; eventId: string; specId: string; proposal: QuoteProposal; by: string; at: Date }): QuoteSuggestionStep {
    const suggestion = new QuoteSuggestion({
      id: input.id,
      specId: input.specId,
      proposal: input.proposal,
      state: 'waiting',
      version: 1,
      suggestedBy: input.by,
      suggestedAt: input.at,
      decidedBy: null,
      decidedAt: null,
      reason: null,
      quoteId: null,
    });
    return { suggestion, event: suggestion.event(input.eventId, 'suggested', input.by, input.at, { after: input.proposal }) };
  }

  /** Rebuilds a quotation that was valid when it was stored. For persistence only. */
  static restore(props: QuoteSuggestionProps): QuoteSuggestion {
    return new QuoteSuggestion(props);
  }

  get id(): string {
    return this.props.id;
  }

  get specId(): string {
    return this.props.specId;
  }

  get proposal(): QuoteProposal {
    return this.props.proposal;
  }

  get state(): QuoteSuggestionState {
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

  get quoteId(): string | null {
    return this.props.quoteId;
  }

  /** Its suggester replaces what it asks for while it waits; the edit is kept with what it said before. */
  edit(
    by: string,
    proposal: QuoteProposal,
    at: Date,
    eventId: string,
  ): Result<QuoteSuggestionStep, QuoteSuggestionNotAllowedError | QuoteSuggestionDecidedError> {
    const refused = this.refusalFor(by);
    if (refused) return err(refused);
    const suggestion = new QuoteSuggestion({ ...this.props, proposal, version: this.version + 1 });
    return ok({ suggestion, event: this.event(eventId, 'edited', by, at, { before: this.proposal, after: proposal }) });
  }

  /** Its suggester takes it back while it waits. */
  withdraw(by: string, at: Date, eventId: string): Result<QuoteSuggestionStep, QuoteSuggestionNotAllowedError | QuoteSuggestionDecidedError> {
    const refused = this.refusalFor(by);
    if (refused) return err(refused);
    const suggestion = new QuoteSuggestion({ ...this.props, state: 'withdrawn', decidedAt: at });
    return ok({ suggestion, event: this.event(eventId, 'withdrawn', by, at, {}) });
  }

  /** An admin who did not add it approves it, as quote `quoteId`. That the approver is an admin is the route's gate. */
  approve(
    by: string,
    at: Date,
    eventId: string,
    quoteId: string,
  ): Result<QuoteSuggestionStep, OwnQuoteSuggestionError | QuoteSuggestionDecidedError> {
    const refused = this.decisionRefusalFor(by);
    if (refused) return err(refused);
    const suggestion = new QuoteSuggestion({ ...this.props, state: 'approved', decidedBy: by, decidedAt: at, quoteId });
    return ok({ suggestion, event: this.event(eventId, 'approved', by, at, {}) });
  }

  /** An admin who did not add it rejects it, saying why: `reason` is already checked. */
  reject(
    by: string,
    reason: string,
    at: Date,
    eventId: string,
  ): Result<QuoteSuggestionStep, OwnQuoteSuggestionError | QuoteSuggestionDecidedError> {
    const refused = this.decisionRefusalFor(by);
    if (refused) return err(refused);
    const suggestion = new QuoteSuggestion({ ...this.props, state: 'rejected', decidedBy: by, decidedAt: at, reason });
    return ok({ suggestion, event: { ...this.event(eventId, 'rejected', by, at, {}), reason } });
  }

  /** Why `by` may not approve or reject it now, or null when they may. */
  decisionRefusalFor(by: string): OwnQuoteSuggestionError | QuoteSuggestionDecidedError | null {
    if (by === this.suggestedBy) return new OwnQuoteSuggestionError();
    if (this.state !== 'waiting') return new QuoteSuggestionDecidedError();
    return null;
  }

  /** Why `by` may not edit or withdraw it now, or null when they may. */
  refusalFor(by: string): QuoteSuggestionNotAllowedError | QuoteSuggestionDecidedError | null {
    if (by !== this.suggestedBy) return new QuoteSuggestionNotAllowedError();
    if (this.state !== 'waiting') return new QuoteSuggestionDecidedError();
    return null;
  }

  private event(
    id: string,
    kind: QuoteSuggestionEventKind,
    by: string,
    at: Date,
    proposals: { before?: QuoteProposal; after?: QuoteProposal },
  ): QuoteSuggestionEvent {
    return { id, suggestionId: this.id, kind, by, at, proposalBefore: proposals.before ?? null, proposalAfter: proposals.after ?? null, reason: null };
  }
}
