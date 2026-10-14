import type { Tool } from './tool';

export interface ToolGroup {
  category: string;
  tools: readonly Tool[];
}

/**
 * One group per category, ignoring case — "Finance" and "finance" are the
 * same shelf, labelled as first seen. Groups and the tools in each are sorted
 * by name, ignoring case.
 */
export function groupByCategory(tools: readonly Tool[]): ToolGroup[] {
  const groups = new Map<string, { category: string; tools: Tool[] }>();

  for (const tool of tools) {
    const key = tool.category.toLowerCase();
    const group = groups.get(key);
    if (group) group.tools.push(tool);
    else groups.set(key, { category: tool.category, tools: [tool] });
  }

  return [...groups.values()]
    .sort((a, b) => compareText(a.category, b.category))
    .map((group) => ({ category: group.category, tools: [...group.tools].sort((a, b) => compareText(a.name, b.name)) }));
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}
