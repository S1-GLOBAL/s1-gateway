/**
 * Every message a Spec ID can fail with, worded exactly as issue #4's copy
 * table, the owner's decisions of 2026-10-16, and the copy tables of issues
 * #28, #34 and #36. The page shows them as they come; nothing else may reword them.
 */
export const specIdMessages = {
  empty: (): string => 'Paste a Spec ID to read it.',
  wrongPartCount: (parts: number): string => `A Spec ID has 25 parts separated by dots. This one has ${parts}.`,
  malformedS1: (length: number, parts: number): string =>
    `An S1 Spec ID is 74 characters in 18 parts. This one has ${length} characters in ${parts} parts.`,
  wrongWidth: (slot: string, value: string, width: number): string =>
    `${slot}: ${value} must be ${width} characters.`,
  notInDictionary: (slot: string, value: string): string => `${slot}: ${value} is not in the dictionary.`,
  mixedMarker: (slot: string, value: string): string => `${slot}: ${value} mixes a marker with other characters.`,
  productTypeRequired: (): string => 'Product type can\'t be "not known": it decides which slots apply.',
  mustNotApply: (slot: string, doesNotApply: string, productType: string): string =>
    `${slot} must be ${doesNotApply} for a ${productType}.`,
  mustApply: (slot: string, productType: string): string =>
    `${slot} can't be "doesn't apply" for a ${productType}.`,
  mustBeNotKnown: (slot: string, notKnown: string, dependsOn: 'shape' | 'material'): string =>
    `${slot} must be ${notKnown} while the ${dependsOn} is not known.`,
  /** A blank value asks for a number: quoting nothing would read "Height: is not a number." */
  notANumber: (slot: string, value: string): string =>
    value.trim() === '' ? `${slot}: type a number.` : `${slot}: ${value} is not a number.`,
  tooManyDecimals: (slot: string, valueWithUnit: string): string =>
    `${slot}: ${valueWithUnit} has more than 6 decimal places.`,
  wrongUnit: (slot: string, unit: string, units: string): string =>
    `${slot}: ${unit} is not a unit for this slot. Use ${units}.`,
  notWhole: (slot: string, value: string): string => `${slot}: ${value} must be a whole number.`,
  outOfRange: (slot: string, value: string, range: string): string => `${slot}: ${value} is outside ${range}.`,
} as const;
