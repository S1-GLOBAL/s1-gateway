import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { isSignInRequired, takePriorSessionEnded, useSession } from '@/features/accounts';
import { useDoorHold } from './door-hold';
import { GateSkeleton } from './gate-skeleton';

export interface RequireAuthProps {
  /** The change-password page itself must open for someone who has to change it. */
  allowMustChangePassword?: boolean;
  children: ReactNode;
}

/**
 * The gate in front of every signed-in page. It asks the API who is signed
 * in. A signed-out visitor goes back to the landing, the only sign-in form,
 * with a return path. A password that must change sends you to
 * /change-password. Any other session failure sends you home — the landing
 * shows the unavailable note from the same query.
 */
export function RequireAuth({ allowMustChangePassword = false, children }: RequireAuthProps) {
  const session = useSession();
  const location = useLocation();
  useDoorHold(session.isPending);

  // The shell and this route's skeleton. A hub refresh does not play the curtain (ADR 0028).
  if (session.isPending) return <GateSkeleton />;

  if (session.isError) {
    if (isSignInRequired(session.error)) {
      const next = encodeURIComponent(`${location.pathname}${location.search}${location.hash}`);
      const sessionEnded = takePriorSessionEnded();
      return <Navigate to={`/?next=${next}`} replace state={sessionEnded ? { sessionEnded: true } : null} />;
    }
    return <Navigate to="/" replace />;
  }

  if (session.data.mustChangePassword && !allowMustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  return children;
}
