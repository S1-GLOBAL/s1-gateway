import { err, ok, type Result } from '../../../../shared/domain/result.js';
import { ToolNameTakenError } from '../../domain/tool.errors.js';
import type { ToolRepository } from '../../domain/tool-repository.js';
import type { Tool } from '../../domain/tool.js';

/** The ToolRepository contract, in memory. A test double, never used in production. */
export class InMemoryToolRepository implements ToolRepository {
  private readonly tools: Tool[] = [];

  async list(): Promise<Tool[]> {
    return [...this.tools].sort((a, b) => compareText(a.category, b.category) || compareText(a.name, b.name));
  }

  async add(tool: Tool): Promise<Result<void, ToolNameTakenError>> {
    const taken = this.tools.some((existing) => existing.name.toLowerCase() === tool.name.toLowerCase());
    if (taken) return err(new ToolNameTakenError(tool.name));
    this.tools.push(tool);
    return ok(undefined);
  }
}

function compareText(a: string, b: string): number {
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
