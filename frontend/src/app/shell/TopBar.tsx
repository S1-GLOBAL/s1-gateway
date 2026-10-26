import { LogOut } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMe, useSignOut } from '@/features/accounts';
import { ThemeSwitch } from '@/features/appearance';
import { Button } from '@/shared/ui/Button';
import { Logo } from '@/shared/ui/Logo';
import { navItemFor } from '../nav';

/** Where you are, and the way out. Your name sits on the sidebar, beside the control that folds it. */
export function TopBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { data: me } = useMe();
  const signOut = useSignOut();
  const here = navItemFor(pathname)?.label ?? 'Not found';

  function leave() {
    signOut.mutate(undefined, { onSuccess: () => navigate('/', { replace: true }) });
  }

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
      <div className="flex shrink-0 items-center gap-3">
        <p className="hidden max-w-40 truncate text-sm text-ink-muted sm:block md:hidden">{me.fullName}</p>
        <ThemeSwitch />
        <Button variant="secondary" size="sm" loading={signOut.isPending} onClick={leave}>
          <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
          Sign out
        </Button>
      </div>
    </header>
  );
}