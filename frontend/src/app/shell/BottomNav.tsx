import * as m from 'motion/react-m';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/shared/ui/cn';
import { NAV_ITEMS } from '../nav';

const MotionLink = m.create(Link);

/** The sidebar's places, as a bottom bar on phones. */
export function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${NAV_ITEMS.length}, minmax(0, 1fr))` }}>
        {NAV_ITEMS.map((item) => {
          const current = pathname === item.path;
          const Icon = item.icon;
          return (
            <li key={item.path}>
              <MotionLink
                to={item.path}
                aria-current={current ? 'page' : undefined}
                initial="rest"
                animate={current ? 'active' : 'rest'}
                whileTap="active"
                className={cn(
                  'relative flex h-16 flex-col items-center justify-center gap-1 text-2xs font-medium',
                  current ? 'text-accent-ink' : 'text-ink-muted',
                )}
              >
                {current && (
                  <m.span
                    layoutId="bottom-nav-mark"
                    aria-hidden="true"
                    className="absolute top-0 h-0.5 w-8 rounded-full bg-accent"
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
                <Icon size={20} />
                {item.label}
              </MotionLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
