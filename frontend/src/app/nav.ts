import type { ComponentType } from 'react';
import { ThemeIcon, ToolsIcon, type IconProps } from '@/shared/ui/icons';

export interface NavItem {
  /** Absolute path. */
  path: string;
  /** In the sidebar, the bottom bar and the top bar. */
  label: string;
  icon: ComponentType<IconProps>;
}

/** Every place in the app, in the order the sidebar shows them. */
export const NAV_ITEMS: readonly NavItem[] = [
  { path: '/', label: 'Tools', icon: ToolsIcon },
  { path: '/theme', label: 'Theme', icon: ThemeIcon },
];

/** The nav item a path belongs to, if any. */
export function navItemFor(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => item.path === pathname);
}
