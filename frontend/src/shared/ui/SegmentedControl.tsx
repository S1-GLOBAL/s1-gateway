import * as m from 'motion/react-m';
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from './cn';
import { iconTrigger } from './motion';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  /** Names the group for assistive technology. */
  label: string;
  value: T;
  options: readonly SegmentedOption<NoInfer<T>>[];
  onChange(value: NoInfer<T>): void;
  /** Show icons only; each label becomes the option's accessible name and tooltip. */
  iconOnly?: boolean;
  className?: string;
}

/**
 * A row of mutually exclusive choices — a radio group. The selected option
 * sits on a pill that slides between options; arrow keys move the selection.
 */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  iconOnly = false,
  className,
}: SegmentedControlProps<T>) {
  const pillId = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    const option = options[next];
    if (!option) return;
    onChange(option.value);
    buttons.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex items-center gap-0.5 rounded-control border border-border bg-surface-sunken p-0.5', className)}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <m.button
            key={option.value}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            {...iconTrigger}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={iconOnly ? option.label : undefined}
            title={iconOnly ? option.label : undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              'relative inline-flex h-7 items-center justify-center gap-1.5 rounded-control text-sm font-medium transition-colors duration-150 ease-standard',
              iconOnly ? 'w-8' : 'px-3',
              selected ? 'text-ink' : 'text-ink-muted hover:text-ink',
            )}
          >
            {selected && (
              <m.span
                layoutId={pillId}
                aria-hidden="true"
                className="absolute inset-0 rounded-control border border-border bg-surface shadow-sm"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative inline-flex items-center gap-1.5">
              {option.icon}
              {!iconOnly && option.label}
            </span>
          </m.button>
        );
      })}
    </div>
  );
}
