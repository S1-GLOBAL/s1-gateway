import { X } from 'lucide-react';
import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from 'react';
import { cn } from './cn';

export interface SheetProps {
  open: boolean;
  onClose(): void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

/**
 * A panel that slides in from the right over a frosted backdrop. Built on the
 * native <dialog>, which traps focus, closes on Escape and restores focus to
 * the button that opened it.
 */
export function Sheet({ open, onClose, title, description, children, className }: SheetProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  // A click on the backdrop lands on the <dialog> itself, never on its content.
  function onClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={onClose}
      onClick={onClick}
      className={cn(
        'm-0 ml-auto h-dvh max-h-dvh w-full max-w-md border-l border-border bg-surface p-0 text-ink shadow-lg',
        'open:animate-[sheet-in_280ms_var(--ease-emphasized)]',
        'backdrop:bg-canvas/70 backdrop:backdrop-blur-sm open:backdrop:animate-[backdrop-in_200ms_var(--ease-standard)]',
        className,
      )}
    >
      <div className="flex h-full flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="text-sm break-words text-ink-muted">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="-mr-2 inline-flex size-8 shrink-0 items-center justify-center rounded-control text-ink-muted transition-colors duration-150 ease-standard hover:bg-surface-sunken hover:text-ink"
          >
            <X size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
      </div>
    </dialog>
  );
}
