import { useId, type SelectHTMLAttributes } from 'react';
import { cn } from './cn';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label: string;
  options: readonly SelectOption[];
  /** One line under the select, shown while there is no error. */
  hint?: string;
  errors?: readonly string[] | undefined;
}

/** A labelled native select, wired like `TextField`: the error replaces the hint and is announced with it. */
export function SelectField({ label, options, hint, errors = [], className, id, ...props }: SelectFieldProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const noteId = `${selectId}-note`;
  const invalid = errors.length > 0;
  const note = invalid ? errors.join(' ') : hint;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={selectId} className="text-sm font-medium text-ink">
        {label}
      </label>
      <select
        id={selectId}
        aria-invalid={invalid || undefined}
        aria-describedby={note ? noteId : undefined}
        className={cn(
          'h-10 rounded-control border border-border-strong bg-surface px-3 text-sm text-ink shadow-sm',
          'transition-colors duration-150 ease-standard hover:border-ink-subtle',
          'disabled:bg-surface-sunken disabled:text-ink-muted aria-invalid:border-danger',
        )}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {note && (
        <p id={noteId} className={cn('text-xs', invalid ? 'text-danger' : 'text-ink-muted')}>
          {note}
        </p>
      )}
    </div>
  );
}
