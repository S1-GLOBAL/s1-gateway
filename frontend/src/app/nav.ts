import type { ComponentType } from 'react';
import { AccountsIcon, AtlasIcon, BookCheckIcon, ThemeIcon, type IconProps } from '@/shared/ui/icons';

export interface NavItem {
  /** Absolute path. */
  path: string;
  /** In the sidebar, the bottom bar and the top bar. Title case. */
  label: string;
  icon: ComponentType<IconProps>;
  /** Shown only to admins. */
  adminOnly?: boolean;
  /** A count it carries, when above 0: the suggestions an admin may decide. */
  badge?: NavBadge;
  /**
   * Sidebar overline shared with the places beside it. The bottom bar stays a
   * flat row, so a phone never shows the overline.
   */
  group?: string;
}

/** One run of places the sidebar draws together. No label means they stand alone. */
export interface NavSection {
  label?: string;
  items: NavItem[];
}

export type NavBadge = 'dictionary-waiting';

/** Each badge's count now; one left out is 0. */
export type NavBadges = Partial<Record<NavBadge, number>>;

/** What a badge's count means, for a screen reader: `2 suggestions waiting`. */
export function badgeLabel(badge: NavBadge, count: number): string {
  switch (badge) {
    case 'dictionary-waiting':
      return count === 1 ? '1 suggestion waiting' : `${count} suggestions waiting`;
  }
}

/**
 * Every place in the app, in the order the sidebar shows them. Theme, the
 * design showcase, is always last. Tools is parked: its API stays, but it has
 * no page or link for now.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { path: '/atlas', label: 'Atlas', icon: AtlasIcon, group: 'Catalog' },
  {
    path: '/dictionary/changes',
    label: 'Dictionary Changes',
    icon: BookCheckIcon,
    badge: 'dictionary-waiting',
    group: 'Catalog',
  },
  { path: '/accounts', label: 'Accounts', icon: AccountsIcon, adminOnly: true, group: 'Access' },
  { path: '/theme', label: 'Theme', icon: ThemeIcon, group: 'Other' },
];

/** The places this person may go: Accounts only for an admin. */
export function navItemsFor(isAdmin: boolean): readonly NavItem[] {
  return NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);
}

/** Runs of places that share an overline, in the order the sidebar shows them. */
export function navSections(items: readonly NavItem[]): NavSection[] {
  const sections: NavSection[] = [];
  for (const item of items) {
    const last = sections.at(-1);
    if (last && last.label === item.group) last.items.push(item);
    else sections.push({ label: item.group, items: [item] });
  }
  return sections;
}

/** Whether a path is this place or a page inside it: `/atlas/new` is in Atlas. */
export function isInPlace(item: NavItem, pathname: string): boolean {
  return pathname === item.path || pathname.startsWith(`${item.path}/`);
}

/** The nav item a path belongs to, if any. */
export function navItemFor(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => isInPlace(item, pathname));
}