import { LazyMotion, MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';

const loadFeatures = () => import('./motion-features').then((module) => module.default);

/**
 * `strict`: a stray `motion.div` (which would bundle every feature eagerly)
 * throws in development. Use `m.div`. `reducedMotion="user"` drops movement
 * for people who asked their OS for less of it.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
