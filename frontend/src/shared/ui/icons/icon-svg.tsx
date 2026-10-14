import type { CSSProperties, ReactNode } from 'react';
import * as m from 'motion/react-m';

export interface IconProps {
  /** Pixels. Default 18. */
  size?: number;
  className?: string;
}

/**
 * The frame every animated icon is drawn in: Lucide's 24px grid and stroke.
 * It has no animation of its own — it passes the `rest` / `active` state set
 * by the element around it down to each stroke (ADR 0012).
 */
export function IconSvg({ size = 18, className, children }: IconProps & { children: ReactNode }) {
  return (
    <m.svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ overflow: 'visible' }}
    >
      {children}
    </m.svg>
  );
}

/** Rotate and scale a stroke about its own centre. */
export const ownCentre: CSSProperties = { transformBox: 'fill-box', transformOrigin: 'center' };

/** Rotate a group of strokes about the centre of the icon. */
export const iconCentre: CSSProperties = { transformBox: 'view-box', transformOrigin: '12px 12px' };
