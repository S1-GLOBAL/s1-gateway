import type { UseCase } from '../../../shared/application/use-case.js';
import type { ToolRepository } from '../domain/tool-repository.js';
import { toToolDto, type ToolDto } from './tool.dto.js';

export class ListTools implements UseCase<void, ToolDto[]> {
  constructor(private readonly tools: ToolRepository) {}

  async execute(): Promise<ToolDto[]> {
    return (await this.tools.list()).map(toToolDto);
  }
}
