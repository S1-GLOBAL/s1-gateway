import * as m from 'motion/react-m';
import { useId } from 'react';
import { cn } from '@/shared/ui/cn';
import { ExternalLinkIcon } from '@/shared/ui/icons';
import { iconTrigger } from '@/shared/ui/motion';
import { isWebUrl } from '../domain/is-web-url';
import type { Tool } from '../domain/tool';
import { toolHost } from '../domain/tool-host';

const CARD = cn(
  'group flex h-full flex-col gap-4 rounded-surface border border-border bg-surface p-5 shadow-sm',
  'transition-[border-color,box-shadow,transform] duration-200 ease-standard',
);

const INTERACTIVE = 'hover:-translate-y-px hover:border-border-strong hover:shadow-md';

/**
 * The whole card is the link, named by the tool's name alone. A URL that is
 * not http(s) is drawn as a plain card: never a link, never clickable.
 */
export function ToolCard({ tool }: { tool: Tool }) {
  const nameId = useId();
  const descriptionId = useId();
  const linkable = isWebUrl(tool.url);

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          aria-hidden="true"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-control bg-surface-sunken text-md font-semibold text-ink"
        >
          {tool.name.slice(0, 1).toUpperCase()}
        </span>
        {linkable && (
          <span className="text-ink-subtle transition-colors duration-150 ease-standard group-hover:text-accent-ink">
            <ExternalLinkIcon size={16} />
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <p id={nameId} className="truncate text-md font-medium text-ink">
          {tool.name}
        </p>
        <p className="truncate font-mono text-xs text-ink-subtle">{toolHost(tool.url)}</p>
      </div>
      {tool.description && (
        <p id={descriptionId} className="line-clamp-2 text-sm text-ink-muted">
          {tool.description}
        </p>
      )}
    </>
  );

  if (!linkable) return <div className={CARD}>{body}</div>;

  return (
    <m.a
      {...iconTrigger}
      href={tool.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-labelledby={nameId}
      aria-describedby={tool.description ? descriptionId : undefined}
      className={cn(CARD, INTERACTIVE)}
    >
      {body}
    </m.a>
  );
}
