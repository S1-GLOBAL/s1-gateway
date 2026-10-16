import type { ComponentType } from 'react';
import { AccountsIcon, AtlasIcon, ThemeIcon, type IconProps } from '@/shared/ui/icons';

export interface NavItem {
  /** Absolute path. */
  path: string;
  /** In the sidebar, the bottom bar and the top bar. */
  label: string;
  icon: ComponentType<IconProps>;
  /** Shown only to admins. */
  adminOnly?: boolean;
}

/**
 * Every place in the app, in the order the sidebar shows them. Tools is
 * parked: its API stays, but it has no page or link for now.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { path: '/theme', label: 'Theme', icon: ThemeIcon },
  { path: '/atlas', label: 'Atlas', icon: AtlasIcon },
  { path: '/accounts', label: 'Accounts', icon: AccountsIcon, adminOnly: true },
];

/** The places this person may go: Accounts only for an admin. */
export function navItemsFor(isAdmin: boolean): readonly NavItem[] {
  return NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);
}

/** The nav item a path belongs to, if any. */
export function navItemFor(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => item.path === pathname);
}