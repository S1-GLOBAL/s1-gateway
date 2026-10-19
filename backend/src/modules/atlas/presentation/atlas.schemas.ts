import { z } from 'zod';
import type {
  CapacityFact,
  DecodeSpecIdRequest,
  EncodeSpecIdRequest,
  MeasurementFact,
  SaveSpecIdRequest,
  SpecIdFacts,
  UpdateSpecIdRequest,
} from '../../../contracts/atlas.js';

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
