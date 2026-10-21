import type { UseCase } from '../../../shared/application/use-case.js';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import type { DictionaryRepository } from '../domain/dictionary-repository.js';
import { readText } from '../domain/reading/read-text.js';
import { CURRENT_RELEASE, slotDefinition, type SlotKey } from '../domain/slots.js';
import { InvalidLookupError, InvalidSpecIdError } from '../domain/spec-id.errors.js';
import { specIdMessages } from '../domain/spec-id.messages.js';
import { meaningOfFact, SpecId, type SpecIdFactsInput } from '../domain/spec-id.js';
import {
  toDecodedSpecIdDto,
  type DecodedSpecIdDto,
  type ReadSpecIdTextInput,
  type SpecIdTextReadingDto,
} from './atlas.dto.js';

/** The most raw text a search reads (#41). */
export const TEXT_MAX_LENGTH = 500;

/**
 * Reads the facts in raw text and, once there is a product type, the code
 * they make (ADR 0026). A fact the product type cannot have is dropped and its
 * words listed as ignored. Nothing is saved.
 */
export class ReadSpecIdText
  implements UseCase<ReadSpecIdTextInput, Result<SpecIdTextReadingDto, InvalidLookupError | InvalidSpecIdError>>
{
  constructor(private readonly dictionaries: DictionaryRepository) {}

  async execute(input: ReadSpecIdTextInput): Promise<Result<SpecIdTextReadingDto, InvalidLookupError | InvalidSpecIdError>> {
    const dictionary = await this.dictionaries.get(CURRENT_RELEASE);
    if (!dictionary) throw new Error(`Dictionary ${CURRENT_RELEASE} is missing`);

    const text = input.text.trim();
    if (text.length === 0) return err(new InvalidLookupError({ text: ['Type some text to read.'] }));
    if (text.length > TEXT_MAX_LENGTH) {
      return err(new InvalidLookupError({ text: [`Search text must be at most ${TEXT_MAX_LENGTH} characters.`] }));
    }
    if (input.productType !== undefined && dictionary.meaningOf('productType', input.productType) === undefined) {
      return err(new InvalidSpecIdError({ productType: [specIdMessages.notInDictionary('Product type', input.productType)] }));
    }

    const reading = readText(text, dictionary, input.productType);
    const facts: Record<string, unknown> = { ...reading.facts };
    const dropped = new Set<SlotKey>();
    let decoded: DecodedSpecIdDto | null = null;
    if (typeof facts.productType === 'string') {
      // A fact the product type cannot have is refused by the build: drop each one and build again.
      for (;;) {
        const built = SpecId.build(facts as unknown as SpecIdFactsInput, dictionary);
        if (built.ok) {
          decoded = toDecodedSpecIdDto(built.value, dictionary);
          break;
        }
        const refused = (Object.keys(built.error.issues) as SlotKey[]).filter((key) => key !== 'productType' && key in facts);
        if (refused.length === 0) break;
        for (const key of refused) {
          delete facts[key];
          dropped.add(key);
        }
      }
    }

    const kept = reading.read.filter((fact) => !dropped.has(fact.key));
    const meaningIn = (key: SlotKey, words: string): string => {
      const slot = decoded?.slots.find((candidate) => candidate.key === key);
      if (slot?.state === 'value') return slot.meaning;
      const fact = facts[key] as Parameters<typeof meaningOfFact>[1] | undefined;
      return (fact !== undefined ? meaningOfFact(key, fact, dictionary) : undefined) ?? words;
    };
    return ok({
      read: kept.map(({ key, words, ruling }) => ({ key, name: slotDefinition(key).name, meaning: meaningIn(key, words), words, ruling })),
      // A size's slots share their words: each dropped phrase is listed once.
      ignored: [...new Set([...reading.ignored, ...reading.read.filter((fact) => dropped.has(fact.key)).map((fact) => fact.words)])],
      conflicts: reading.conflicts.map(({ key, found }) => ({ key, name: slotDefinition(key).name, found: [...found] })),
      decoded,
    });
  }
}
