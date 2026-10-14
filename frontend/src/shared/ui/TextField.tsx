import { useId, type InputHTMLAttributes } from 'react';
import { cn } from './cn';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  errors?: readonly string[] | undefined;
}

export function TextField({ label, errors = [], className, id, ...props }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const invalid = errors.length > 0;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={inputId} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        className="rounded-box border border-border bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent aria-invalid:border-danger"
        {...props}
      />
      {invalid && (
        <p id={errorId} className="text-sm text-danger">
          {errors.join(' ')}
        </p>
      )}
    </div>
  );
}
