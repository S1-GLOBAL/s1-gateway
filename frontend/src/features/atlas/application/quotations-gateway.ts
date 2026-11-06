import type { ManufacturerOption, Quotation, QuotationDetail, QuotationFields } from '../domain/quotation';

/**
 * Where the Atlas feature adds, reads and decides quotations (plan 0017, ADR
 * 0035). The application owns this port; infrastructure implements it over
 * HTTP. Every method rejects with an AppError: a quotation's problems arrive
 * under the field each is about (`manufacturer`, `manufacturerName`,
 * `fobPerUnit`, …), and a missing or long reason under `fields.reason`.
 */
export interface QuotationsGateway {
  /** Every manufacturer, by name, to choose from. */
  manufacturers(): Promise<ManufacturerOption[]>;
  /** Adds a quotation to a Spec ID. None of its quotes change until an admin approves it. */
  add(specId: string, fields: QuotationFields): Promise<Quotation>;
  /** Whoever added it, while it waits: replaces it, from the `version` they read. */
  edit(id: string, fields: QuotationFields, version: number): Promise<Quotation>;
  /** Waiting oldest first; decided latest decision first; all, or one Spec ID's. */
  list(state: 'waiting' | 'decided', specId?: string): Promise<Quotation[]>;
  /** One quotation with its trail. */
  get(id: string): Promise<QuotationDetail>;
  /** How many waiting quotations the signed-in person did not add. */
  waitingCount(): Promise<number>;
  /** Admins only: approves the `version` the approver read, adding its quote to the Spec ID. */
  approve(id: string, version: number): Promise<Quotation>;
  /** Admins only: rejects with a reason whoever added it sees. */
  reject(id: string, reason: string): Promise<Quotation>;
  /** Whoever added it, while it waits. */
  withdraw(id: string): Promise<Quotation>;
}
