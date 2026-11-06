import { z } from 'zod';
import type {
  ApproveQuoteSuggestionRequest,
  EditQuoteSuggestionRequest,
  RejectQuoteSuggestionRequest,
  SuggestQuoteRequest,
} from '../../../contracts/atlas.js';

/*
 * The quotation routes' bodies (plan 0017). These check only the shape: what
 * a quotation must hold, and how long each value may be, is the domain's call
 * (`checkQuoteProposal`), so its messages name the form's fields.
 */

const text = z.string().nullish();

const quotationFields = {
  manufacturer: z.object({ id: text, name: text, country: text }),
  values: z.object({
    itemName: text,
    fobPerUnit: text,
    fobPerCase: text,
    fobTotal: text,
    moldCost: text,
    moldLeadTime: text,
    sampleLeadTime: text,
    productionLeadTime: text,
  }),
};

export const suggestQuoteRequestSchema = z.object({ specId: z.guid(), ...quotationFields }) satisfies z.ZodType<SuggestQuoteRequest>;

export const editQuoteSuggestionRequestSchema = z.object({
  version: z.number().int().positive(),
  ...quotationFields,
}) satisfies z.ZodType<EditQuoteSuggestionRequest>;

/** An approval names the version the approver read. */
export const approveQuoteSuggestionRequestSchema = z.object({
  version: z.number().int().positive(),
}) satisfies z.ZodType<ApproveQuoteSuggestionRequest>;

/** A missing reason is an empty one, so the domain answers it in its own words. */
export const rejectQuoteSuggestionRequestSchema = z.object({
  reason: z.string().default(''),
}) satisfies z.ZodType<RejectQuoteSuggestionRequest>;

/** A quotation's id: anything else names no quotation, so it is answered 404 before any query. */
export const quoteSuggestionIdSchema = z.guid();

/** `?state=` of the list: waiting unless it says decided. */
export const quoteSuggestionListStateSchema = z.enum(['waiting', 'decided']).catch('waiting');

/** `?specId=` of the list: one Spec ID's, or, when absent or not an id, all. */
export const quoteSuggestionSpecIdSchema = z.guid().optional().catch(undefined);
