import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { useState } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { duration, ease } from '@/shared/ui/motion';

/**
 * The leaving page keeps rendering what it rendered: without this, the outlet
 * would already show the next page while the old one fades out.
 */
function FrozenOutlet() {
  const outlet = useOutlet();
  const [frozen] = useState(outlet);
  return frozen;
}

/**
 * Only the content region moves between pages; the shell stays put (ADR 0012).
 * Leave: fade and lift 4px, 120ms. Arrive: rise 8px out of a 4px blur, 240ms.
 */
export function AnimatedOutlet() {
  const { pathname } = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.main
        key={pathname}
        id="content"
        initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.24, ease: ease.emphasized } }}
        exit={{ opacity: 0, y: -4, filter: 'blur(0px)', transition: { duration: duration.fast, ease: ease.exit } }}
        className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-28 sm:px-6 md:pb-12"
      >
        <FrozenOutlet />
      </m.main>
    </AnimatePresence>
  );
}
