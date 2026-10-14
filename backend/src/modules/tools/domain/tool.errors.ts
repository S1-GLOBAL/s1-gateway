import { DomainError } from '../../../shared/domain/domain-error.js';

export type ToolField = 'name' | 'url' | 'description' | 'category';
export type ToolIssues = Partial<Record<ToolField, string[]>>;

export class InvalidToolError extends DomainError {
  override readonly code = 'VALIDATION_FAILED';

  constructor(readonly issues: ToolIssues) {
    super('The tool is not valid.', { fields: issues });
  }
}

export class ToolNameTakenError extends DomainError {
  override readonly code = 'TOOL_NAME_TAKEN';

  constructor(name: string) {
    const message = `A tool named "${name}" already exists.`;
    super(message, { fields: { name: [message] } });
  }
}
