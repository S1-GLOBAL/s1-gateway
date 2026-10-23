import type { AdminStage, ManufacturerStage, SpecIdManufacturer } from './atlas';

/** Each stage's name and what it means, in the order the page shows them (#57). */
export const STAGES: readonly { stage: ManufacturerStage; name: string; description: string }[] = [
  {
    stage: 'specifications-received',
    name: 'Specifications received',
    description: 'Product details on file, no quotation yet',
  },
  { stage: 'quoted', name: 'Quoted', description: 'Quotation received' },
  { stage: 'sampling', name: 'Sampling', description: 'Samples in progress' },
  { stage: 'in-production', name: 'In production', description: 'In mass production' },
];

export interface ManufacturerGroup {
  stage: ManufacturerStage;
  name: string;
  description: string;
  manufacturers: SpecIdManufacturer[];
}

/** The manufacturers in their stage's group, in #57's order. A group with none is left out. */
export function manufacturerGroups(manufacturers: readonly SpecIdManufacturer[]): ManufacturerGroup[] {
  return STAGES.map(({ stage, name, description }) => ({
    stage,
    name,
    description,
    manufacturers: manufacturers.filter((manufacturer) => manufacturer.stage === stage),
  })).filter((group) => group.manufacturers.length > 0);
}

/** A stage's name, as "Set to {stage}" writes it. */
export function stageName(stage: ManufacturerStage | AdminStage): string {
  return STAGES.find((entry) => entry.stage === stage)?.name ?? stage;
}

/** A quote's value as written; a value the workbook left empty is "—". */
export function shownValue(value: string | null): string {
  return value === null || value.trim() === '' ? '—' : value;
}

/** A lead time written as a whole number is "{n} days"; any other is as written, or "—". */
export function shownLeadTime(value: string | null): string {
  const shown = shownValue(value);
  return /^\d+$/.test(shown) ? `${shown} days` : shown;
}
