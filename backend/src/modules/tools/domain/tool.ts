import { err, ok, type Result } from '../../../shared/domain/result.js';
import { InvalidToolError, type ToolIssues } from './tool.errors.js';

export const TOOL_LIMITS = { name: 80, url: 2048, description: 280, category: 40 } as const;

export interface ToolProps {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly description: string;
  readonly category: string;
  readonly createdAt: Date;
}

export interface NewTool {
  name: string;
  url: string;
  description?: string | undefined;
  category: string;
}

/** An internal application or link a staff member can open from the hub. */
export class Tool {
  private constructor(private readonly props: ToolProps) {}

  /**
   * Checks every rule and reports all the broken ones together, so a form can
   * show every problem at once rather than one per attempt.
   */
  static create(input: NewTool, id: string, createdAt: Date): Result<Tool, InvalidToolError> {
    const name = input.name.trim();
    const url = input.url.trim();
    const description = (input.description ?? '').trim();
    const category = input.category.trim();
    const issues: ToolIssues = {};

    if (hasControlCharacter(name)) issues.name = ['Name must not contain control characters.'];
    else if (name.length === 0) issues.name = ['Name is required.'];
    else if (name.length > TOOL_LIMITS.name) {
      issues.name = [`Name must be at most ${TOOL_LIMITS.name} characters.`];
    }

    if (hasControlCharacter(url)) issues.url = ['URL must not contain control characters.'];
    else if (url.length > TOOL_LIMITS.url) {
      issues.url = [`URL must be at most ${TOOL_LIMITS.url} characters.`];
    } else if (!isWebUrl(url)) {
      issues.url = ['URL must be a full http:// or https:// address.'];
    }

    if (hasControlCharacter(description)) {
      issues.description = ['Description must not contain control characters.'];
    } else if (description.length > TOOL_LIMITS.description) {
      issues.description = [`Description must be at most ${TOOL_LIMITS.description} characters.`];
    }

    if (hasControlCharacter(category)) issues.category = ['Category must not contain control characters.'];
    else if (category.length === 0) issues.category = ['Category is required.'];
    else if (category.length > TOOL_LIMITS.category) {
      issues.category = [`Category must be at most ${TOOL_LIMITS.category} characters.`];
    }

    if (Object.keys(issues).length > 0) return err(new InvalidToolError(issues));
    return ok(new Tool({ id, name, url, description, category, createdAt }));
  }

  /** Rebuilds a tool that was valid when it was stored. For persistence only. */
  static restore(props: ToolProps): Tool {
    return new Tool(props);
  }

  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get url(): string {
    return this.props.url;
  }

  get description(): string {
    return this.props.description;
  }

  get category(): string {
    return this.props.category;
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }
}

/**
 * Every field is a single line of text. Postgres also refuses NUL outright,
 * which would otherwise surface as a 500 rather than a validation message.
 */
function hasControlCharacter(value: string): boolean {
  // eslint-disable-next-line no-control-regex -- matching control characters is the point
  return /[\u0000-\u001f\u007f]/.test(value);
}

/** Only web addresses: a `javascript:` URL in a link is script injection. */
function isWebUrl(value: string): boolean {
  if (!URL.canParse(value)) return false;
  const { protocol } = new URL(value);
  return protocol === 'http:' || protocol === 'https:';
}
