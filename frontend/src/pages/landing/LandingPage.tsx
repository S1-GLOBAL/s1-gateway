import * as m from 'motion/react-m';
import { Navigate, useNavigate } from 'react-router-dom';
import { isSignInRequired, SignInForm, useSession } from '@/features/accounts';
import { ThemeSwitch } from '@/features/appearance';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Logo } from '@/shared/ui/Logo';
import { RefreshIcon } from '@/shared/ui/icons';
import { ease } from '@/shared/ui/motion';
import { LandingPageSkeleton } from './LandingPageSkeleton';

/**
 * The signed-out front door. Brand on one plane, the sign-in form on the other.
 * When the session check fails for a reason other than signed-out, the same
 * page shows a calm unavailable note — never a raw API ErrorState.
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
    <main className="flex min-h-dvh justify-center bg-canvas p-3 sm:p-4 lg:p-6">
      <m.div
        initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.24, ease: ease.emphasized } }}
        className="flex w-full max-w-6xl flex-1 flex-col overflow-hidden rounded-surface border border-border bg-surface shadow-lg"
      >
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6 sm:px-8">
          <span className="text-ink">
            <Logo variant="wordmark" height={22} />
          </span>
          <ThemeSwitch />
        </header>

        <div className="flex flex-1 flex-col md:flex-row">
          <div className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-8">
            <div className="flex w-full max-w-lg flex-col gap-4">
              <h1 className="text-3xl font-semibold text-balance text-ink">Internal tools in one place.</h1>
              <p className="text-md text-ink-muted">Open the one you came for.</p>
            </div>
          </div>

          <div className="flex flex-1 flex-col justify-center border-t border-border bg-surface-sunken px-4 py-8 sm:px-8 md:w-[28rem] md:flex-none md:border-t-0 md:border-l">
            <Card className="flex w-full flex-col gap-6 p-6">
              <span className="flex justify-center text-ink">
                <Logo variant="mark" height={40} />
              </span>
              <p className="text-base text-ink-muted">Use your Source One email and password.</p>
              {unavailable ? (
                <div className="flex flex-col gap-3">
                  <p role="status" className="text-sm text-ink-muted">
                    The Gateway is temporarily unavailable.
                  </p>
                  <Button variant="secondary" onClick={() => void session.refetch()}>
                    <RefreshIcon size={16} />
                    Try again
                  </Button>
                </div>
              ) : null}
              <SignInForm onSignedIn={() => navigate('/atlas', { replace: true })} />
            </Card>
          </div>
        </div>
      </m.div>
    </main>
  );
}
