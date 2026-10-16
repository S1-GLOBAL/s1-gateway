import { Navigate, useNavigate } from 'react-router-dom';
import { isSignInRequired, useSession } from '@/features/accounts';
import { ThemeSwitch } from '@/features/appearance';
import { Button } from '@/shared/ui/Button';
import { Logo } from '@/shared/ui/Logo';
import { RefreshIcon } from '@/shared/ui/icons';
import { LandingPageSkeleton } from './LandingPageSkeleton';

/**
 * The signed-out front door. Brand first; Sign in only. When the session
 * check fails for a reason other than signed-out, the same page shows a calm
 * unavailable note — never a raw API ErrorState.
 */
export function LandingPage() {
  const session = useSession();
  const navigate = useNavigate();

  if (session.isPending) {
    return <LandingPageSkeleton />;
  }

  if (!session.isError) {
    return <Navigate to="/atlas" replace />;
  }

  const unavailable = !isSignInRequired(session.error);

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center gap-8 bg-canvas px-4 py-12">
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <ThemeSwitch />
      </div>
      <span className="text-ink">
        <Logo variant="wordmark" height={40} />
      </span>
      <div className="flex max-w-md flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold text-ink">Source One&apos;s Staff Hub.</h1>
        <p className="text-base text-ink-muted">Internal tools for Source One Global staff.</p>
      </div>
      {unavailable ? (
        <div className="flex max-w-md flex-col items-center gap-3 text-center">
          <p role="status" className="text-sm text-ink-muted">
            The Gateway is temporarily unavailable.
          </p>
          <Button variant="secondary" onClick={() => void session.refetch()}>
            <RefreshIcon size={16} />
            Try again
          </Button>
        </div>
      ) : null}
      <Button onClick={() => navigate('/sign-in')}>Sign in</Button>
    </main>
  );
}
