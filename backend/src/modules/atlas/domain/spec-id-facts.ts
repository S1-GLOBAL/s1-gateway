/*
 * What is known about a product, as it is given to be built into a Spec ID.
 * Apart from `spec-id.ts`, so the code's spelling (`code.ts`) can read facts
 * without the Spec ID it builds.
 */

/** A measured value as typed: `{ value: "1.375", unit: "in" }`. */
export interface MeasurementInput {
  readonly value: string;
  readonly unit: string;
}

/** A capacity unit letter and an amount: `{ unit: "Z", value: "6" }`, or `"3.25"` (ADR 0032). */
export interface CapacityInput {
  readonly unit: string;
  readonly value: string;
}

/**
 * What is known about a product. A slot left out, or `null`, has no value:
 * it is left out of the code.
 */
export interface SpecIdFactsInput {
  readonly productType: string;
  readonly material?: string | null | undefined;
  readonly coating?: string | null | undefined;
  readonly colourClarity?: string | null | undefined;
  readonly shape?: string | null | undefined;
  readonly profile?: string | null | undefined;
  readonly capacity?: CapacityInput | null | undefined;
  readonly topDiameter?: MeasurementInput | null | undefined;
  readonly bottomDiameter?: MeasurementInput | null | undefined;
  readonly height?: MeasurementInput | null | undefined;
  readonly length?: MeasurementInput | null | undefined;
  readonly width?: MeasurementInput | null | undefined;
  readonly gusset?: MeasurementInput | null | undefined;
  readonly unitWeight?: MeasurementInput | null | undefined;
  readonly basisWeight?: MeasurementInput | null | undefined;
  readonly thickness?: MeasurementInput | null | undefined;
  readonly wall?: string | null | undefined;
  readonly print?: string | null | undefined;
  /** A whole number as text, 1–12. */
  readonly compartments?: string | null | undefined;
  /** A whole number as text, 1–4. */
  readonly plies?: string | null | undefined;
  readonly lidOpening?: string | null | undefined;
  readonly handle?: string | null | undefined;
  readonly wrap?: string | null | undefined;
  readonly window?: string | null | undefined;
}

/** A writable copy of the facts while a code or a description is being read. */
export type FactDraft = {
  -readonly [K in keyof SpecIdFactsInput]?: SpecIdFactsInput[K];
};
