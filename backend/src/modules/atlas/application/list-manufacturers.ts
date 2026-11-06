import type { UseCase } from '../../../shared/application/use-case.js';
import type { SourcingRepository } from '../domain/sourcing/sourcing-repository.js';
import { toManufacturerDto, type ManufacturerDto } from './quote-suggestion.dto.js';

/** Every manufacturer, by name: those a quotation may choose (ADR 0035). */
export class ListManufacturers implements UseCase<void, ManufacturerDto[]> {
  constructor(private readonly sourcing: Pick<SourcingRepository, 'manufacturers'>) {}

  async execute(): Promise<ManufacturerDto[]> {
    return (await this.sourcing.manufacturers()).map(toManufacturerDto);
  }
}
