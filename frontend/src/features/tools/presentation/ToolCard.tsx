import { Card } from '@/shared/ui/Card';
import { isWebUrl } from '../domain/is-web-url';
import type { Tool } from '../domain/tool';

export function ToolCard({ tool }: { tool: Tool }) {
  return (
    <Card className="flex h-full flex-col gap-1">
      {isWebUrl(tool.url) ? (
        <a
          href={tool.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-accent-ink hover:underline"
        >
          {tool.name}
        </a>
      ) : (
        <span className="font-medium">{tool.name}</span>
      )}
      {tool.description && <p className="text-sm text-ink-muted">{tool.description}</p>}
    </Card>
  );
}
