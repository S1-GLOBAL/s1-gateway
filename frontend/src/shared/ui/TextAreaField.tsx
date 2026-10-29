import { useId, type TextareaHTMLAttributes } from 'react';
import { cn } from './cn';

export interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  /** One line under the text area, shown while there is no error. */
  hint?: string;
  errors?: readonly string[] | undefined;
}

/** A labelled text area for several lines, wired like `TextField`: the error replaces the hint and is announced with it. */
export function TextAreaField({ label, hint, errors = [], className, id, rows = 4, ...props }: TextAreaFieldProps) {
  const generatedId = useId();
  const textAreaId = id ?? generatedId;
  const noteId = `${textAreaId}-note`;
  const invalid = errors.length > 0;
  const note = invalid ? errors.join(' ') : hint;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={textAreaId} className="text-sm font-medium text-ink">
        {label}
      </label>
      <textarea
        id={textAreaId}
        rows={rows}
        aria-invalid={invalid || undefined}
        aria-describedby={note ? noteId : undefined}
        className={cn(
          'resize-y rounded-control border border-border-strong bg-surface px-3 py-2 text-sm text-ink shadow-sm',
          'transition-colors duration-150 ease-standard placeholder:text-ink-subtle hover:border-ink-subtle',
          'aria-invalid:border-danger',
        )}
        {...props}
      />
      {note && (
        <p id={noteId} className={cn('text-xs', invalid ? 'text-danger' : 'text-ink-muted')}>
          {note}
        </p>
      )}
    </div>
  );
}
