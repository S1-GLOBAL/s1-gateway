import type { Clock } from '../../../shared/application/ports/clock.js';
import type { IdGenerator } from '../../../shared/application/ports/id-generator.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { ok, type Result } from '../../../shared/domain/result.js';
import type { InvalidToolError, ToolNameTakenError } from '../domain/tool.errors.js';
import type { ToolRepository } from '../domain/tool-repository.js';
import { Tool } from '../domain/tool.js';
import { toToolDto, type CreateToolInput, type ToolDto } from './tool.dto.js';

export type CreateToolError = InvalidToolError | ToolNameTakenError;

export class CreateTool implements UseCase<CreateToolInput, Result<ToolDto, CreateToolError>> {
  constructor(
    private readonly tools: ToolRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: CreateToolInput): Promise<Result<ToolDto, CreateToolError>> {
    const created = Tool.create(input, this.ids.next(), this.clock.now());
    if (!created.ok) return created;

    // Uniqueness is the repository's to decide: only the database can rule
    // out two simultaneous requests both taking the same name.
    const added = await this.tools.add(created.value);
    if (!added.ok) return added;

    return ok(toToolDto(created.value));
  }
}
