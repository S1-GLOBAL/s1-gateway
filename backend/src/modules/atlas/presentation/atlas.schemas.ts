import { z } from 'zod';
import type {
  CapacityFact,
  DecodeSpecIdRequest,
  EncodeSpecIdRequest,
  MeasurementFact,
  SpecIdFacts,
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
}) satisfies z.ZodType<SpecIdFacts>;

export const decodeSpecIdRequestSchema = z.object({
  code: z.string(),
}) satisfies z.ZodType<DecodeSpecIdRequest>;

export const encodeSpecIdRequestSchema = z.object({
  facts: specIdFactsSchema,
}) satisfies z.ZodType<EncodeSpecIdRequest>;
