import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { isSignInRequired, takePriorSessionEnded, useSession } from '@/features/accounts';
import { SkeletonBlock, SkeletonRegion } from '@/shared/ui/Skeleton';
import { useDoorHold } from './door-hold';

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

/** Blank canvas until we know who is here; invisible when the answer is quick (ADR 0013). */
function GateSkeleton() {
  return (
    <SkeletonRegion label="the Gateway" className="flex min-h-dvh flex-col gap-6 bg-canvas p-6">
      <SkeletonBlock className="h-8 w-40" order={0} />
      <SkeletonBlock className="h-64 w-full" order={1} />
    </SkeletonRegion>
  );
}