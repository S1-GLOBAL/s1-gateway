import * as m from 'motion/react-m';
import { Link } from 'react-router-dom';
import { cn } from '@/shared/ui/cn';
import { SidebarIcon } from '@/shared/ui/icons';
import { Logo } from '@/shared/ui/Logo';
import { duration, ease, iconTrigger } from '@/shared/ui/motion';
import type { NavItem } from '../nav';
import { SidebarLink } from './SidebarLink';

export const SIDEBAR_WIDTH = { expanded: 248, collapsed: 72 } as const;

export function Sidebar({
  items,
  collapsed,
  onToggle,
}: {
  items: readonly NavItem[];
  collapsed: boolean;
  onToggle(): void;
}) {
  return (
    <m.aside
      aria-label="Main"
      initial={false}
      animate={{ width: collapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded }}
      transition={{ duration: duration.slow, ease: ease.emphasized }}
      className="sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-surface md:flex"
    >
      <div className={cn('flex h-14 shrink-0 items-center', collapsed ? 'justify-center' : 'px-5')}>
        <Link to="/" aria-label="Source One Gateway, home" className="rounded-control text-ink">
          {collapsed ? <Logo variant="mark" height={22} /> : <Logo variant="wordmark" height={22} />}
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4">
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.path}>
              <SidebarLink item={item} collapsed={collapsed} />
            </li>
          ))}
        </ul>
      </nav>

      <div className={cn('flex shrink-0 border-t border-border p-3', collapsed ? 'justify-center' : 'justify-end')}>
        <m.button
          {...iconTrigger}
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="inline-flex size-9 items-center justify-center rounded-control text-ink-muted transition-colors duration-150 ease-standard hover:bg-surface-sunken hover:text-ink"
        >
          <SidebarIcon collapsed={collapsed} />
        </m.button>
      </div>
    </m.aside>
  );
}
