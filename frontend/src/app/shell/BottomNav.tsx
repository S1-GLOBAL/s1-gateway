import * as m from 'motion/react-m';
import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Badge } from '@/shared/ui/Badge';
import { cn } from '@/shared/ui/cn';
import { useIconTrigger } from '@/shared/ui/motion';
import { badgeLabel, isInPlace, type NavBadges, type NavItem } from '../nav';

const MotionLink = m.create(Link);

/** The sidebar's places, as a bottom bar on phones, with the same counts. */
export function BottomNav({ items, badges = {} }: { items: readonly NavItem[]; badges?: NavBadges }) {
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => (
          <li key={item.path}>
            <BottomNavLink item={item} count={item.badge ? (badges[item.badge] ?? 0) : 0} current={isInPlace(item, pathname)} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function BottomNavLink({ item, count, current }: { item: NavItem; count: number; current: boolean }) {
  const Icon = item.icon;
  const { play, trigger } = useIconTrigger();

  useEffect(() => {
    if (current) play();
  }, [current, play]);

  return (
    <MotionLink
      to={item.path}
      aria-current={current ? 'page' : undefined}
      {...trigger}
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
      {item.badge && count > 0 && (
        <>
          <Badge aria-hidden="true" tone="accent" className="absolute top-2 left-1/2 ml-2 h-4 px-1.5">
            {count}
          </Badge>
          <span className="sr-only">{` ${badgeLabel(item.badge, count)}`}</span>
        </>
      )}
    </MotionLink>
  );
}
