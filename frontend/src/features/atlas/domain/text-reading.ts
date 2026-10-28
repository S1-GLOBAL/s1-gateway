import type { SpecIdTextReading } from './atlas';
import { summarise } from './spec-id-summary';

/** The facts read, in words: the code's own summary once there is one, else each fact's meaning. */
export function readInWords(reading: SpecIdTextReading): string {
  return reading.decoded ? summarise(reading.decoded) : reading.read.map((fact) => fact.meaning).join(' · ');
}
