import { Tool } from '../domain/tool.js';
import type { tools } from './tools.table.js';

type ToolRow = typeof tools.$inferSelect;
type NewToolRow = typeof tools.$inferInsert;

export function toDomain(row: ToolRow): Tool {
  return Tool.restore({
    id: row.id,
    name: row.name,
    url: row.url,
    description: row.description,
    category: row.category,
    createdAt: row.createdAt,
  });
}

export function toRow(tool: Tool): NewToolRow {
  return {
    id: tool.id,
    name: tool.name,
    url: tool.url,
    description: tool.description,
    category: tool.category,
    createdAt: tool.createdAt,
  };
}
