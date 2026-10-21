import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** One line under the input, shown while there is no error. */
  hint?: string;
  errors?: readonly string[] | undefined;
  /**
   * A control level with the input, at its right, such as a button. Pass `null`
   * while it is hidden: the input keeps its place, and its focus, when it appears.
   */
  action?: ReactNode;
}

export function TextField({ label, hint, errors = [], action, className, id, ...props }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const noteId = `${inputId}-note`;
  const invalid = errors.length > 0;
  const note = invalid ? errors.join(' ') : hint;

  const input = (
    <input
      id={inputId}
      aria-invalid={invalid || undefined}
      aria-describedby={note ? noteId : undefined}
      className={cn(
        'h-10 rounded-control border border-border-strong bg-surface px-3 text-sm text-ink shadow-sm',
        'transition-colors duration-150 ease-standard placeholder:text-ink-subtle hover:border-ink-subtle',
        'aria-invalid:border-danger',
        action !== undefined && 'min-w-0 flex-1',
      )}
      {...props}
    />
  );

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={inputId} className="text-sm font-medium text-ink">
        {label}
      </label>
      {action === undefined ? (
        input
      ) : (
        <div className="flex gap-2">
          {input}
          {action}
        </div>
      )}
      {note && (
        <p id={noteId} className={cn('text-xs', invalid ? 'text-danger' : 'text-ink-muted')}>
          {note}
        </p>
      )}
    </div>
  );
}
