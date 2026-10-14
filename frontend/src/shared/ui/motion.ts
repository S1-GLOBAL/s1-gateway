/**
 * Motion tokens — ADR 0012. Seconds, because that is what `motion` takes.
 * The same curves exist as CSS custom properties in styles/theme.css.
 */
export const duration = {
  fast: 0.12,
  base: 0.2,
  slow: 0.32,
} as const;

export const ease = {
  standard: [0.2, 0, 0, 1],
  emphasized: [0.05, 0.7, 0.1, 1],
  exit: [0.3, 0, 1, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

/**
 * The two states every animated icon knows. The element an icon sits in sets
 * them — `initial="rest"`, `whileHover="active"`, `whileFocus="active"` — and
 * they propagate down to each stroke.
 */
export const iconTrigger = {
  initial: 'rest',
  whileHover: 'active',
  whileFocus: 'active',
} as const;
