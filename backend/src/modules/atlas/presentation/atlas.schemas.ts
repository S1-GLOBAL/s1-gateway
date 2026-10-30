import { z } from 'zod';
import type {
  CapacityFact,
  DecodeSpecIdRequest,
  ApproveDictionarySuggestionRequest,
  DictionaryProposal,
  EditDictionarySuggestionRequest,
  RejectDictionarySuggestionRequest,
  EncodeSpecIdRequest,
  ReadSpecIdTextRequest,
  MeasurementFact,
  SaveSpecIdRequest,
  SetManufacturerStageRequest,
  SpecIdFacts,
  SuggestDictionaryChangeRequest,
  UpdateSpecIdRequest,
} from '../../../contracts/atlas.js';
import { DICTIONARY_SLOTS, RULED_SLOTS, SLOT_RULES } from '../domain/slots.js';

/*
 * The request's shape only. Every rule — codes, units, ranges, which slots
 * apply — belongs to the domain, which reports each against its slot.
 */

const measurementSchema = z.object({ value: z.string(), unit: z.string() }) satisfies z.ZodType<MeasurementFact>;

const capacitySchema = z.object({ unit: z.string(), value: z.string() }) satisfies z.ZodType<CapacityFact>;

const optionalCode = z.string().nullable().optional();
const optionalMeasurement = measurementSchema.nullable().optional();

export const specIdFactsSchema = z.object({
  productType: z.string(),
  material: optionalCode,
  coating: optionalCode,
  colourClarity: optionalCode,
  shape: optionalCode,
  profile: optionalCode,
  capacity: capacitySchema.nullable().optional(),
  topDiameter: optionalMeasurement,
  bottomDiameter: optionalMeasurement,
  height: optionalMeasurement,
  length: optionalMeasurement,
  width: optionalMeasurement,
  gusset: optionalMeasurement,
  unitWeight: optionalMeasurement,
  basisWeight: optionalMeasurement,
  thickness: optionalMeasurement,
  wall: optionalCode,
  print: optionalCode,
  // Counts are text the domain reads, so a bad one is refused beside its slot.
  compartments: optionalCode,
  plies: optionalCode,
  lidOpening: optionalCode,
  handle: optionalCode,
  wrap: optionalCode,
  window: optionalCode,
}) satisfies z.ZodType<SpecIdFacts>;

export const decodeSpecIdRequestSchema = z.object({
  code: z.string(),
}) satisfies z.ZodType<DecodeSpecIdRequest>;

export const encodeSpecIdRequestSchema = z.object({
  facts: specIdFactsSchema,
}) satisfies z.ZodType<EncodeSpecIdRequest>;

export const readSpecIdTextRequestSchema = z.object({
  text: z.string(),
  productType: z.string().optional(),
}) satisfies z.ZodType<ReadSpecIdTextRequest>;

export const saveSpecIdRequestSchema = z.object({
  name: z.string(),
  facts: specIdFactsSchema,
}) satisfies z.ZodType<SaveSpecIdRequest>;

export const updateSpecIdRequestSchema = z.object({
  name: z.string(),
  facts: specIdFactsSchema,
  version: z.number().int().positive(),
}) satisfies z.ZodType<UpdateSpecIdRequest>;

/** A saved Spec ID's id: anything else names no Spec ID, so it is answered 404 before any query. */
export const savedSpecIdIdSchema = z.guid();

/** `stage` is required: `null` clears it, and any other value is refused (#57). */
export const setManufacturerStageRequestSchema = z.object({
  stage: z.enum(['sampling', 'in-production']).nullable(),
}) satisfies z.ZodType<SetManufacturerStageRequest>;

/** A manufacturer's id: anything else names no manufacturer, so it is answered 404 before any query. */
export const manufacturerIdSchema = z.guid();

const rulesSchema = z.partialRecord(z.enum(RULED_SLOTS), z.enum(SLOT_RULES));

/** A suggestion's proposal, by kind (#95). Whether it may be made is the domain's call. */
const proposalSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('add'),
    meaning: z.string(),
    searchWords: z.array(z.string()),
    rules: rulesSchema.nullable(),
    broader: z.string().nullable().optional(),
  }),
  z.object({
    kind: z.literal('edit'),
    newCode: z.string().nullable(),
    meaning: z.string().nullable(),
    searchWords: z.array(z.string()).nullable(),
  }),
  z.object({ kind: z.literal('delete'), replacement: z.string().nullable() }),
  z.object({ kind: z.literal('rules'), rules: rulesSchema }),
]) satisfies z.ZodType<DictionaryProposal>;

export const suggestDictionaryChangeRequestSchema = z.object({
  slot: z.enum(DICTIONARY_SLOTS),
  code: z.string(),
  proposal: proposalSchema,
}) satisfies z.ZodType<SuggestDictionaryChangeRequest>;

export const editDictionarySuggestionRequestSchema = suggestDictionaryChangeRequestSchema.extend({
  version: z.number().int().positive(),
}) satisfies z.ZodType<EditDictionarySuggestionRequest>;

/** An approval names the version the approver read (#95). */
export const approveDictionarySuggestionRequestSchema = z.object({
  version: z.number().int().positive(),
}) satisfies z.ZodType<ApproveDictionarySuggestionRequest>;

/**
 * Whether the reason is long enough, and its words, are the domain's call. A
 * missing reason is an empty one, so it is answered in #95's words too.
 */
export const rejectDictionarySuggestionRequestSchema = z.object({
  reason: z.string().default(''),
}) satisfies z.ZodType<RejectDictionarySuggestionRequest>;

/** A suggestion's id: anything else names no suggestion, so it is answered 404 before any query. */
export const suggestionIdSchema = z.guid();

/** `?state=` of the suggestion list: waiting unless it says decided. */
export const suggestionListStateSchema = z.enum(['waiting', 'decided']).catch('waiting');
