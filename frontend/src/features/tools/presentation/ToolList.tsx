import { groupByCategory } from '../domain/group-by-category';
import type { Tool } from '../domain/tool';
import { ToolCard } from './ToolCard';

export function ToolList({ tools }: { tools: readonly Tool[] }) {
  const groups = groupByCategory(tools);

  if (groups.length === 0) {
    return <p className="text-ink-muted">No tools yet. Add the first one below.</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      {groups.map((group) => (
        <section key={group.category.toLowerCase()} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{group.category}</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.tools.map((tool) => (
              <li key={tool.id}>
                <ToolCard tool={tool} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
