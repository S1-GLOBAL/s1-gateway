import type { ManufacturerQuote, Staff } from './atlas';

/*
 * A quotation someone added to a Spec ID in Atlas, waiting for an admin or
 * decided (plan 0017, ADR 0035). None of the Spec ID's quotes change until an
 * admin who did not add it approves it.
 */

export type QuotationState = 'waiting' | 'approved' | 'rejected' | 'withdrawn';

/** A quotation's manufacturer: one already in Atlas, or a new one, made only when it is approved. */
export type QuotationManufacturer =
  | { kind: 'existing'; id: string; name: string; country: string | null }
  | { kind: 'new'; name: string; country: string | null };

export interface Quotation {
  id: string;
  specId: string;
  specName: string;
  specCode: string;
  manufacturer: QuotationManufacturer;
  /** As written; FOB per unit always given. */
  values: ManufacturerQuote;
  state: QuotationState;
  /** Raised on each edit: an approval or an edit names the one it was made from. */
  version: number;
  suggestedBy: Staff;
  suggestedAt: Date;
  decidedBy: Staff | null;
  decidedAt: Date | null;
  reason: string | null;
}

export interface QuotationEvent {
  kind: 'suggested' | 'edited' | 'withdrawn' | 'approved' | 'rejected';
  by: Staff;
  at: Date;
  reason: string | null;
}

/** A quotation with every step of its trail, the first first. */
export interface QuotationDetail extends Quotation {
  trail: QuotationEvent[];
}

/** A manufacturer to choose for a quotation. */
export interface ManufacturerOption {
  id: string;
  name: string;
  country: string | null;
}

/**
 * A quotation as the form sends it: a manufacturer chosen by `id`, or a new
 * one by `name` and `country`; the quote's values as typed. The server trims
 * them, and an empty one is nothing.
 */
export interface QuotationFields {
  manufacturer: { id: string } | { name: string; country: string };
  values: Partial<Record<keyof ManufacturerQuote, string>>;
}

/** A quote's values, with the labels the manufacturers screen uses, in its order; FOB per unit is the one required. */
export const QUOTATION_FIELDS: readonly { key: keyof ManufacturerQuote; label: string; required?: true; hint?: string }[] = [
  { key: 'itemName', label: 'Item name', hint: 'As the manufacturer names it.' },
  { key: 'fobPerUnit', label: 'FOB per unit (USD)', required: true, hint: 'As quoted, for example $0.0350, or $35 per 1000.' },
  { key: 'fobPerCase', label: 'FOB per case (USD)' },
  { key: 'fobTotal', label: 'FOB total (USD)' },
  { key: 'moldCost', label: 'Mold cost' },
  { key: 'sampleLeadTime', label: 'Sample lead time' },
  { key: 'productionLeadTime', label: 'Production lead time' },
  { key: 'moldLeadTime', label: 'Mold lead time' },
];

/** What the viewer may do with a quotation: whoever added it edits or withdraws it; an admin who did not, decides it. */
export function quotationActions(quotation: Quotation, viewer: { id: string; isAdmin: boolean }) {
  const waiting = quotation.state === 'waiting';
  const own = quotation.suggestedBy.id === viewer.id;
  return { edit: waiting && own, withdraw: waiting && own, decide: waiting && !own && viewer.isAdmin };
}

/** Where a quotation stands, in a line. */
export function quotationStateLine(quotation: Quotation): string {
  const decider = quotation.decidedBy?.fullName ?? 'an admin';
  switch (quotation.state) {
    case 'waiting':
      return 'Waiting for an admin';
    case 'approved':
      return `Approved by ${decider}: it is among the Spec ID's quotes`;
    case 'rejected':
      return `Rejected by ${decider}: ${quotation.reason ?? ''}`;
    case 'withdrawn':
      return 'Withdrawn';
  }
}

/** The fields to edit a quotation from: as it asks now. */
export function fieldsOf(quotation: Quotation): QuotationFields {
  const values = Object.fromEntries(QUOTATION_FIELDS.map(({ key }) => [key, quotation.values[key] ?? ''])) as QuotationFields['values'];
  return {
    manufacturer:
      quotation.manufacturer.kind === 'existing'
        ? { id: quotation.manufacturer.id }
        : { name: quotation.manufacturer.name, country: quotation.manufacturer.country ?? '' },
    values,
  };
}
