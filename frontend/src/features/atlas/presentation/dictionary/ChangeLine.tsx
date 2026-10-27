import { ArrowRight } from 'lucide-react';
import type { ChangeRow } from '../../domain/suggestion';

/** One field of a suggestion: what it is now, struck through, when known, then what it would be. */
export function ChangeLine({ change }: { change: ChangeRow }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-ink-muted">{change.label}</dt>
      <dd className="flex flex-wrap items-center gap-1.5 text-ink">
        {change.before !== null && (
          <>
            <span className="min-w-0 break-words text-ink-muted line-through">{change.before}</span>
            <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" className="text-ink-subtle" />
            <span className="sr-only">to</span>
          </>
        )}
        <span className="min-w-0 break-words">{change.after}</span>
      </dd>
    </div>
  );
}
