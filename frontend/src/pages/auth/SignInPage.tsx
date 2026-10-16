import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { SignInForm, safeNextPath } from '@/features/accounts';
import { AUTH_LINK, AuthLayout } from './AuthLayout';

export function SignInPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const location = useLocation();
  const next = safeNextPath(params.get('next'));
  const sessionEnded = (location.state as { sessionEnded?: boolean } | null)?.sessionEnded === true;

  return (
    <AuthLayout
      title="Sign in"
      description="Use your Source One email and password."
      footer={
        <>
          New here?{' '}
          <Link to="/sign-up" className={AUTH_LINK}>
            Create an account
          </Link>
        </>
      }
    >
      {sessionEnded && (
        <p role="status" className="rounded-control bg-info-soft px-3 py-2 text-sm text-info">
          Your session ended. Sign in again.
        </p>
      )}
      <SignInForm onSignedIn={() => navigate(next, { replace: true })} />
    </AuthLayout>
  );
}