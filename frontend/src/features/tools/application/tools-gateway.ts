import type { NewTool, Tool } from '../domain/tool';

/**
 * Where the tools feature gets and sends tools. The application owns this
 * port; infrastructure implements it over HTTP. Every method rejects with an
 * AppError.
 */
export interface ToolsGateway {
  list(): Promise<Tool[]>;
  create(input: NewTool): Promise<Tool>;
}
