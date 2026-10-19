import * as m from 'motion/react-m';
import { Link } from 'react-router-dom';
import { cn } from '@/shared/ui/cn';
import { SidebarIcon } from '@/shared/ui/icons';
import { Logo } from '@/shared/ui/Logo';
import { duration, ease, iconTrigger } from '@/shared/ui/motion';
import type { NavItem } from '../nav';
import { SidebarLink } from './SidebarLink';

export const SIDEBAR_WIDTH = { expanded: 248, collapsed: 72 } as const;

/** The signed-in person, as the sidebar footer shows them. */
export interface SidebarAccount {
  firstName: string;
  lastName: string;
  /** "First Last", or just the first name when there is no last name. */
  fullName: string;
  email: string;
}

/**
 * Two letters for the mark beside the name: given name and family name.
 * A single name uses its first two letters, so the mark still reads as a person.
 */
export function accountInitials(firstName: string, lastName: string): string {
  const first = firstName.trim();
  const last = lastName.trim();
  if (first && last) return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  return (first || last).slice(0, 2).toUpperCase();
}

export function Sidebar({
  items,
  account,
  collapsed,
  onToggle,
}: {
  items: readonly NavItem[];
  account: SidebarAccount;
  collapsed: boolean;
  onToggle(): void;
}) {
  const initials = accountInitials(account.firstName, account.lastName);
  const email = account.email.trim();

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

      <div
        className={cn(
          'flex shrink-0 items-center border-t border-border p-3',
          collapsed ? 'flex-col gap-2' : 'gap-2',
        )}
      >
        <div
          className={cn(
            'group relative flex min-w-0 items-center',
            collapsed ? 'justify-center' : 'min-h-9 flex-1 gap-3 overflow-hidden rounded-control px-2.5',
          )}
        >
          {initials && (
            <span
              aria-hidden="true"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-control bg-surface-sunken text-2xs font-medium text-ink"
            >
              {initials}
            </span>
          )}
          <span className={cn('min-w-0', collapsed ? 'sr-only' : 'flex-1')}>
            <span className="block truncate text-sm font-medium text-ink" title={account.fullName}>
              {account.fullName}
            </span>
            {email && (
              <span className="block truncate text-xs text-ink-subtle" title={email}>
                {email}
              </span>
            )}
          </span>
          {collapsed && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-full z-20 ml-3 rounded-control bg-ink px-2 py-1 text-xs text-canvas opacity-0 shadow-md transition-opacity duration-150 ease-standard group-hover:opacity-100"
            >
              <span className="block whitespace-nowrap font-medium">{account.fullName}</span>
              {email && <span className="block whitespace-nowrap font-normal">{email}</span>}
            </span>
          )}
        </div>
        <m.button
          {...iconTrigger}
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-control text-ink-muted transition-colors duration-150 ease-standard hover:bg-surface-sunken hover:text-ink"
        >
          <SidebarIcon collapsed={collapsed} />
        </m.button>
      </div>
    </m.aside>
  );
}
