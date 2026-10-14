import { useLocation } from 'react-router-dom';
import { ThemeSwitch } from '@/features/appearance';
import { Logo } from '@/shared/ui/Logo';
import { navItemFor } from '../nav';

/** Where you are, and the theme. Nothing else lives here until it does something. */
export function TopBar() {
  const { pathname } = useLocation();
  const here = navItemFor(pathname)?.label ?? 'Not found';

  return (
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
      <ThemeSwitch />
    </header>
  );
}
