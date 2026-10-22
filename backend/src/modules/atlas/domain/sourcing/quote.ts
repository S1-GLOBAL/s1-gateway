/**
 * What one verified-list row says a manufacturer offers for a Spec ID, each
 * value as the workbook shows it, null when the cell is empty (ADR 0027).
 * Prices are written several ways, such as per 1000 pouches, so they are
 * never read as numbers.
 */
export interface QuoteValues {
  readonly itemName: string | null;
  readonly fobPerUnit: string | null;
  readonly fobPerCase: string | null;
  readonly fobTotal: string | null;
  readonly moldCost: string | null;
  readonly moldLeadTime: string | null;
  readonly sampleLeadTime: string | null;
  readonly productionLeadTime: string | null;
}

export interface Quote {
  readonly id: string;
  readonly specId: string;
  readonly manufacturerId: string;
  readonly values: QuoteValues;
  readonly importedAt: Date;
}
