import type { Tool } from '../domain/tool.js';

/** A tool as the application hands it outward. Dates are ISO 8601 strings. */
export interface ToolDto {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  createdAt: string;
}

export interface CreateToolInput {
  name: string;
  url: string;
  description?: string | undefined;
  category: string;
}

export function toToolDto(tool: Tool): ToolDto {
  return {
    id: tool.id,
    name: tool.name,
    url: tool.url,
    description: tool.description,
    category: tool.category,
    createdAt: tool.createdAt.toISOString(),
  };
}
