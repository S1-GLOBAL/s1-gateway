import type { SpecIdTextReading, TextConflict } from './atlas';
import { joinNames } from './left-out-slots';
import { summarise } from './spec-id-summary';

/** The facts read, in words: the code's own summary once there is one, else each fact's meaning. */
export function readInWords(reading: SpecIdTextReading): string {
  return reading.decoded ? summarise(reading.decoded) : reading.read.map((fact) => fact.meaning).join(' · ');
}

/** `Material: found both PET and PP, so it's left as not known.` — "both" only for exactly two. */
export function conflictSentence(conflict: TextConflict): string {
  const found = joinNames(conflict.found);
  return `${conflict.name}: found ${conflict.found.length === 2 ? `both ${found}` : found}, so it's left as not known.`;
}
