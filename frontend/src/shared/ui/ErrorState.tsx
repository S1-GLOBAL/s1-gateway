import * as m from 'motion/react-m';
import { Button } from './Button';
import { cn } from './cn';
import { AlertIcon, RefreshIcon } from './icons';

export interface ErrorStateProps {
  title?: string;
  /** The reason, in a sentence. Usually the AppError's message. */
  message: string;
  onRetry?: () => void;
  className?: string;
}

/** A calm failure in the frame the content would have filled — never a blank page. */
export function ErrorState({ title = 'This could not load.', message, onRetry, className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-start gap-4 rounded-surface border border-border bg-surface p-6 shadow-sm sm:flex-row sm:items-center',
        className,
      )}
    >
      <m.span
        initial="rest"
        animate="active"
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger"
      >
        <AlertIcon size={20} />
      </m.span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-md font-medium text-ink">{title}</p>
        <p className="text-sm text-ink-muted">{message}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          <RefreshIcon size={16} />
          Try again
        </Button>
      )}
    </div>
  );
}
