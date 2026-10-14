import type { HTMLMotionProps } from 'motion/react';
import * as m from 'motion/react-m';
import type { ReactNode } from 'react';
import { cn } from './cn';
import { iconTrigger } from './motion';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent shadow-sm hover:bg-accent-hover',
  secondary: 'border border-border-strong bg-surface text-ink shadow-sm hover:bg-surface-raised',
  ghost: 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
  danger: 'bg-danger text-surface shadow-sm hover:opacity-90',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-3 text-sm',
  md: 'h-10 gap-2 px-4 text-sm',
};

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner, marks the button busy and stops further presses. */
  loading?: boolean;
  children?: ReactNode;
}

/**
 * Any animated icon inside plays when the button is hovered or focused — the
 * button sets the icon states (ADR 0012).
 */
export function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <m.button
      {...iconTrigger}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-control font-medium',
        'transition-[background-color,color,opacity,transform] duration-150 ease-standard active:translate-y-px',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="size-3.5 animate-[spin_700ms_linear_infinite] rounded-full border-2 border-current border-r-transparent"
        />
      )}
      {children}
    </m.button>
  );
}
