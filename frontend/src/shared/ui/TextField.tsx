import { useId, type InputHTMLAttributes } from 'react';
import { cn } from './cn';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** One line under the input, shown while there is no error. */
  hint?: string;
  errors?: readonly string[] | undefined;
}

export function TextField({ label, hint, errors = [], className, id, ...props }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const noteId = `${inputId}-note`;
  const invalid = errors.length > 0;
  const note = invalid ? errors.join(' ') : hint;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={inputId} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={invalid || undefined}
        aria-describedby={note ? noteId : undefined}
        className={cn(
          'h-10 rounded-control border border-border-strong bg-surface px-3 text-sm text-ink shadow-sm',
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
