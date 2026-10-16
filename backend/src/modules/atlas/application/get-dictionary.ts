import type { UseCase } from '../../../shared/application/use-case.js';
import type { DictionaryRepository } from '../domain/dictionary-repository.js';
import { CURRENT_RELEASE } from '../domain/slots.js';
import { toDictionaryDto, type DictionaryDto } from './atlas.dto.js';

export class GetDictionary implements UseCase<void, DictionaryDto> {
  constructor(private readonly dictionaries: DictionaryRepository) {}

  async execute(): Promise<DictionaryDto> {
    const dictionary = await this.dictionaries.get(CURRENT_RELEASE);
    if (!dictionary) throw new Error(`Dictionary ${CURRENT_RELEASE} is missing`);
    return toDictionaryDto(dictionary);
  }
}
