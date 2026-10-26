import { ChevronLeft, ChevronRight } from 'lucide-react';
import * as m from 'motion/react-m';
import { useId, type ReactNode } from 'react';
import { cn } from './cn';
import { paginationItems } from './pagination-items';

export interface PaginationProps {
  /** The page being shown, starting at 1. */
  page: number;
  /** Pages that can be shown now. */
  pageCount: number;
  /** One more page exists beyond `pageCount`, and is offered as the next number. */
  hasMore?: boolean;
  onPageChange(page: number): void;
  /** The page a press is waiting on. */
  pendingPage?: number;
  /** Names the group for assistive technology. */
  label?: string;
  className?: string;
}

/**
 * Numbered pages. The current one sits on a raised surface — the same
 * selection as a segmented control — so lime stays the primary action.
 * One page, or none, renders nothing.
 */
export function Pagination({
  page,
  pageCount,
  hasMore = false,
  onPageChange,
  pendingPage,
  label = 'Pages',
  className,
}: PaginationProps) {
  const pillId = useId();
  const total = pageCount + (hasMore ? 1 : 0);
  if (total <= 1) return null;

  const busy = pendingPage !== undefined;
  const items = paginationItems(page, total);

  return (
    <nav
      aria-label={label}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-control border border-border bg-surface-sunken p-0.5',
        className,
      )}
    >
      <PageStep
        label="Previous page"
        disabled={busy || page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" />
      </PageStep>
      {items.map((item, index) =>
        item === 'gap' ? (
          <span key={`gap-${index}`} aria-hidden="true" className="px-1.5 text-sm text-ink-subtle">
            …
          </span>
        ) : (
          <m.button
            key={item}
            type="button"
            aria-label={`Page ${item}`}
            aria-current={item === page ? 'page' : undefined}
            aria-busy={item === pendingPage || undefined}
            disabled={busy && item !== page}
            onClick={() => onPageChange(item)}
            className={cn(
              'relative inline-flex h-10 min-w-10 items-center justify-center rounded-control px-2 text-sm font-medium',
              'transition-colors duration-150 ease-standard disabled:pointer-events-none',
              item === page ? 'text-ink' : 'text-ink-muted hover:text-ink',
              item !== pendingPage && 'disabled:opacity-50',
            )}
          >
            {item === page && (
              <m.span
                layoutId={pillId}
                aria-hidden="true"
                className="absolute inset-0 rounded-control border border-border bg-surface shadow-sm"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
            <span className={cn('relative', item === pendingPage && 'invisible')}>{item}</span>
            {item === pendingPage && (
              <span
                aria-hidden="true"
                className="absolute size-3.5 animate-[spin_700ms_linear_infinite] rounded-full border-2 border-current border-r-transparent"
              />
            )}
          </m.button>
        ),
      )}
      <PageStep label="Next page" disabled={busy || page >= total} onClick={() => onPageChange(page + 1)}>
        <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
      </PageStep>
    </nav>
  );
}

function PageStep({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick(): void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex size-10 items-center justify-center rounded-control text-ink-muted',
        'transition-colors duration-150 ease-standard hover:text-ink',
        'disabled:pointer-events-none disabled:opacity-50',
      )}
    >
      {children}
    </button>
  );
}
