import * as m from 'motion/react-m';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { ThemeSwitch } from '@/features/appearance';
import { AccountsPageSkeleton } from '@/pages/accounts/AccountsPageSkeleton';
import { AtlasPageSkeleton } from '@/pages/atlas/AtlasPageSkeleton';
import { ManufacturersPageSkeleton } from '@/pages/atlas/ManufacturersPageSkeleton';
import { NewSpecIdPageSkeleton } from '@/pages/atlas/NewSpecIdPageSkeleton';
import { SpecIdPageSkeleton } from '@/pages/atlas/SpecIdPageSkeleton';
import { AuthPageSkeleton } from '@/pages/auth/AuthPageSkeleton';
import { ThemePageSkeleton } from '@/pages/theme/ThemePageSkeleton';
import { cn } from '@/shared/ui/cn';
import { Logo } from '@/shared/ui/Logo';
import { SidebarIcon } from '@/shared/ui/icons';
import { useIconTrigger } from '@/shared/ui/motion';
import { SkeletonBlock, SkeletonRegion, SkeletonText } from '@/shared/ui/Skeleton';
import { navItemFor, navItemsFor } from '../nav';
import { BottomNav } from './BottomNav';
import { SIDEBAR_WIDTH } from './Sidebar';
import { SidebarLink } from './SidebarLink';
import { useSidebarCollapsed } from './use-sidebar-collapsed';

/**
 * What `/auth/me` is still answering. The shell is already the shape it will
 * be, and the content is that route's own skeleton (ADR 0013). The person's
 * name stays a block, and Accounts stays out, until we know who is signed in.
 * Change password sits outside the shell, so it keeps the bare form skeleton.
 */
export function GateSkeleton() {
  const { pathname } = useLocation();
  const { trigger } = useIconTrigger();
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();
  if (pathname === '/change-password') return <AuthPageSkeleton />;

  const places = navItemsFor(false);
  const here = navItemFor(pathname)?.label ?? 'Not found';

  return (
    <div className="flex min-h-dvh bg-canvas">
      <div
        className="sticky top-0 z-20 hidden h-dvh shrink-0 flex-col border-r border-border bg-surface md:flex"
        style={{ width: collapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded }}
      >
        <div className={cn('flex h-14 shrink-0 items-center', collapsed ? 'justify-center' : 'px-5')}>
          <span className="text-ink">
            {collapsed ? <Logo variant="mark" height={22} /> : <Logo variant="wordmark" height={22} />}
          </span>
        </div>
        <nav className="flex-1 px-3 py-4">
          <ul className="flex flex-col gap-1">
            {places.map((item) => (
              <li key={item.path}>
                <SidebarLink item={item} collapsed={collapsed} />
              </li>
            ))}
          </ul>
        </nav>
        <div className={cn('flex shrink-0 items-center border-t border-border p-3', collapsed ? 'flex-col gap-2' : 'gap-2')}>
          <div
            className={cn(
              'flex min-w-0 items-center',
              collapsed ? 'justify-center' : 'min-h-9 flex-1 gap-3 overflow-hidden rounded-control px-2.5',
            )}
          >
            <SkeletonBlock className="size-8 shrink-0" order={0} />
            <span className={cn('min-w-0', collapsed ? 'sr-only' : 'flex-1')}>
              <SkeletonText size="sm" className="w-24" order={1} />
              <SkeletonText size="xs" className="w-32" order={2} />
            </span>
          </div>
          <m.button
            {...trigger}
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-control text-ink-muted transition-colors duration-150 ease-standard hover:bg-surface-sunken hover:text-ink"
          >
            <SidebarIcon collapsed={collapsed} />
          </m.button>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-canvas/80 px-4 backdrop-blur-md sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="text-ink md:hidden">
              <Logo variant="mark" height={20} />
            </span>
            <p className="flex min-w-0 items-center gap-2 text-sm">
              <span className="hidden text-ink-subtle sm:inline">Gateway</span>
              <span aria-hidden="true" className="hidden text-border-strong sm:inline">
                /
              </span>
              <span className="truncate font-medium text-ink">{here}</span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <ThemeSwitch />
            <SkeletonBlock className="h-8 w-28" order={0} />
          </div>
        </header>
        <main id="content" className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-28 sm:px-6 md:pb-12">
          <HubContentSkeleton pathname={pathname} />
        </main>
      </div>

      <BottomNav items={places} />
    </div>
  );
}

/** The route's own skeleton, so a slow session check shows the page that is coming. */
function HubContentSkeleton({ pathname }: { pathname: string }): ReactNode {
  if (pathname === '/atlas/new') return <NewSpecIdPageSkeleton />;
  if (/^\/atlas\/[^/]+\/manufacturers$/.test(pathname)) return <ManufacturersPageSkeleton />;
  if (/^\/atlas\/[^/]+$/.test(pathname)) return <SpecIdPageSkeleton />;
  if (pathname === '/atlas') return <AtlasPageSkeleton />;
  if (pathname === '/accounts') return <AccountsPageSkeleton />;
  if (pathname === '/theme') return <ThemePageSkeleton />;
  return (
    <SkeletonRegion label="the page" className="flex flex-col gap-3 py-16">
      <SkeletonText size="sm" className="w-10" order={0} />
      <SkeletonText size="2xl" className="w-80 max-w-full" order={1} />
      <SkeletonText size="base" className="w-96 max-w-full" order={2} />
    </SkeletonRegion>
  );
}
