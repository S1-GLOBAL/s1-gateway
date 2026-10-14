import { Badge } from '@/shared/ui/Badge';
import { groupByCategory } from '../domain/group-by-category';
import type { Tool } from '../domain/tool';
import { ToolCard } from './ToolCard';

/** Tools grouped by category. The empty state belongs to the page, not to this list. */
export function ToolList({ tools }: { tools: readonly Tool[] }) {
  return (
    <div className="flex flex-col gap-10">
      {groupByCategory(tools).map((group) => (
        <section key={group.category.toLowerCase()} aria-label={group.category} className="flex flex-col gap-4">
          <h2 className="flex items-center gap-2 text-sm font-medium text-ink-muted">
            {group.category}
            <Badge>{group.tools.length}</Badge>
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
