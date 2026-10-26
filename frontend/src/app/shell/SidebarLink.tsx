import * as m from 'motion/react-m';
import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/shared/ui/cn';
import { useIconTrigger } from '@/shared/ui/motion';
import { isInPlace, type NavItem } from '../nav';

const MotionLink = m.create(Link);

/**
 * One place in the sidebar. The current one sits on the lime pill, which
 * slides between items (ADR 0012); its icon plays once on arrival and on
 * hover. Folded to the rail, the label becomes a tooltip.
 */
export function SidebarLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const { pathname } = useLocation();
  const current = isInPlace(item, pathname);
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
        'group relative flex h-9 items-center gap-3 rounded-control px-2.5 text-sm font-medium outline-offset-0',
        current ? 'text-on-accent' : 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
      )}
    >
      {current && (
        <m.span
          layoutId="sidebar-pill"
          aria-hidden="true"
          className="absolute inset-0 rounded-control bg-accent shadow-sm"
          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
        />
      )}
      <span className="relative shrink-0">
        <Icon size={18} />
      </span>
      <span className={cn('relative truncate', collapsed && 'sr-only')}>{item.label}</span>
      {collapsed && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-full z-20 ml-3 whitespace-nowrap rounded-control bg-ink px-2 py-1 text-xs font-medium text-canvas opacity-0 shadow-md transition-opacity duration-150 ease-standard group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          {item.label}
        </span>
      )}
    </MotionLink>
  );
}
