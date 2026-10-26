import type { CSSProperties } from 'react';
import { cn } from './cn';

/** Width over height of each crop in public/brand/. */
const ART = {
  wordmark: { src: '/brand/wordmark.png', ratio: 2527 / 424 },
  mark: { src: '/brand/mark.png', ratio: 589 / 424 },
} as const;

export interface LogoProps {
  variant?: keyof typeof ART;
  /** Height in pixels; the width follows the artwork. */
  height?: number;
  className?: string;
  /** Hide it from assistive tech when the name is written beside it. */
  decorative?: boolean;
}

/**
 * Source One's logo. The PNG is a mask filled with the current text colour,
 * so the same file is dark on the light theme and light on the dark one.
 */
export function Logo({ variant = 'wordmark', height = 28, className, decorative = false }: LogoProps) {
  const { src, ratio } = ART[variant];
  const style: CSSProperties = {
    height,
    width: Math.round(height * ratio),
    maskImage: `url(${src})`,
    WebkitMaskImage: `url(${src})`,
    maskSize: 'contain',
    WebkitMaskSize: 'contain',
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
    maskPosition: 'left center',
    WebkitMaskPosition: 'left center',
  };
  return (
    <span
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : 'Source One'}
      aria-hidden={decorative ? true : undefined}
      className={cn('inline-block shrink-0 bg-current', className)}
      style={style}
    />
  );
}

/**
 * The mark, then the name in the door's mono face, a step above a sidebar
 * label. The landing header and the open sidebar use this.
 */
export function SourceOneName({ height = 22, className }: { height?: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-ink', className)}>
      <Logo variant="mark" height={height} decorative />
      <span className="font-mono text-md font-semibold">Source One</span>
    </span>
  );
}
