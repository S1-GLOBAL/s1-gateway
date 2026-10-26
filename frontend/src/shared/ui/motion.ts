import { useAnimationControls, useReducedMotion } from 'motion/react';
import { useCallback, useRef } from 'react';

/**
 * Motion tokens — ADR 0012. Seconds, because that is what `motion` takes.
 * The door curtain travels longer than a hub transition, and then holds still
 * (ADR 0028). The same curves exist as CSS custom properties in styles/theme.css.
 */
export const duration = {
  fast: 0.12,
  base: 0.2,
  slow: 0.32,
  /** Rise from the bottom, and the rise away. The still time between them is `curtainHold`. */
  curtain: 0.6,
  /** How long the curtain stays still, so the line can be read. */
  curtainHold: 2,
} as const;

export const ease = {
  standard: [0.2, 0, 0, 1],
  emphasized: [0.05, 0.7, 0.1, 1],
  exit: [0.3, 0, 1, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

/**
 * Plays an animated icon's `active` sequence through to its rest pose.
 *
 * `whileHover` would drop the variant the moment the pointer leaves, and a
 * stroke caught mid-redraw (a `pathLength` of 0, a cover half-scaled) stays
 * that way. Hover, focus and a tap start the sequence; leaving does not stop
 * it. Reduced motion never starts it (ADR 0012).
 */
export function useIconTrigger() {
  const reduced = useReducedMotion() === true;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const controls = useAnimationControls();

  const play = useCallback(() => {
    if (reducedRef.current) return;
    try {
      void controls.start('active');
    } catch {
      // The controls mount with the icon. A gesture before that has nothing to play.
    }
  }, [controls]);

  return {
    /** Starts the sequence. A nav item calls this once when its route becomes current. */
    play,
    trigger: {
      initial: 'rest' as const,
      animate: controls,
      onHoverStart: play,
      onFocus: play,
      onTapStart: play,
    },
  };
}
