import type { ReactNode } from 'react';
import { cn } from './cn';

/**
 * How long a skeleton stays invisible (ADR 0013). A load faster than this
 * never shows one. The fade itself is CSS (`.skeleton-region` in index.css).
 */
export const SKELETON_DELAY_MS = 150;

/** Gap between one block fading in and the next, top to bottom. */
const STAGGER_MS = 30;

/** Wraps a page-shaped skeleton. Announced once as "Loading <label>". */
export function SkeletonRegion({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={`Loading ${label}`}
      className={cn('skeleton-region', className)}
      style={{ animationDelay: `${SKELETON_DELAY_MS}ms` }}
    >
      {children}
    </div>
  );
}

/**
 * One grey block. `order` staggers its fade-in. Size it with classes exactly
 * as the real element is sized, so nothing moves when the page arrives.
 */
export function SkeletonBlock({ className, order = 0 }: { className?: string; order?: number }) {
  return (
    <div
      aria-hidden="true"
      className={cn('skeleton-block', className)}
      // The second value is the shimmer's delay: none, so every block shares one sweep.
      style={{ animationDelay: `${SKELETON_DELAY_MS + order * STAGGER_MS}ms, 0ms` }}
    />
  );
}

/** Line boxes, from the type scale in theme.css. */
const LINE: Record<'xs' | 'sm' | 'base' | 'md' | 'lg' | 'xl' | '2xl' | '3xl', string> = {
  xs: 'h-4 text-xs',
  sm: 'h-5 text-sm',
  base: 'h-[22px] text-base',
  md: 'h-6 text-md',
  lg: 'h-7 text-lg',
  xl: 'h-8 text-xl',
  '2xl': 'h-10 text-2xl',
  '3xl': 'h-12 text-3xl',
};

/**
 * A line of text: a bar the height of the letters, centred in a box the height
 * of the line, so it takes exactly the space the text will.
 */
export function SkeletonText({
  size = 'base',
  className,
  order = 0,
}: {
  size?: keyof typeof LINE;
  /** Width classes, e.g. `w-48` or `w-2/3`. */
  className?: string;
  order?: number;
}) {
  return (
    <div aria-hidden="true" className={cn('flex items-center', LINE[size], className)}>
      <SkeletonBlock order={order} className="h-[0.7em] w-full rounded-full" />
    </div>
  );
}
