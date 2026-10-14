import type { Result } from '../../../shared/domain/result.js';
import type { ToolNameTakenError } from './tool.errors.js';
import type { Tool } from './tool.js';

/** Where tools are kept. The domain owns this port; infrastructure implements it. */
export interface ToolRepository {
  /** Every tool, ordered by category and then name, both ignoring case. */
  list(): Promise<Tool[]>;

  /** Fails with ToolNameTakenError when a tool already has this name, ignoring case. */
  add(tool: Tool): Promise<Result<void, ToolNameTakenError>>;
}
