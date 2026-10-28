import type { UseCase } from '../../../shared/application/use-case.js';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import type { DictionaryRepository } from '../domain/dictionary-repository.js';
import { describeText, factsInWords } from '../domain/reading/describe-text.js';
import { CURRENT_RELEASE, slotDefinition } from '../domain/slots.js';
import { InvalidLookupError, InvalidSpecIdError } from '../domain/spec-id.errors.js';
import { specIdMessages } from '../domain/spec-id.messages.js';
import { toDecodedSpecIdDto, type ReadSpecIdTextInput, type SpecIdTextReadingDto } from './atlas.dto.js';

/** The most raw text a search reads (#41). */
export const TEXT_MAX_LENGTH = 500;

/**
 * Reads the facts in raw text and, once there is a product type, the code
 * they make (ADR 0026, ADR 0032). A fact the product type cannot have is left
 * out, and a note says why; so does each fact the text gives two values for,
 * and each size converted. Words nothing used, and no note explains, are
 * listed as ignored. Nothing is saved.
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

    const description = describeText(text, dictionary, input.productType);
    // A fact a later pass read, such as a size written beside its name, has no words of its own.
    const words = new Map(description.reading.read.map((fact) => [fact.key, fact]));
    return ok({
      read: factsInWords(description, dictionary).map(({ key, name, meaning }) => ({
        key,
        name,
        meaning,
        words: words.get(key)?.words ?? '',
        ruling: words.get(key)?.ruling ?? null,
      })),
      ignored: [...description.ignored],
      conflicts: description.reading.conflicts.map(({ key, found }) => ({ key, name: slotDefinition(key).name, found: [...found] })),
      notes: [...description.notes],
      decoded: description.specId ? toDecodedSpecIdDto(description.specId, dictionary) : null,
    });
  }
}
