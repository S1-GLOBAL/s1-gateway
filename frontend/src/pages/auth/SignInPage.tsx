import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { SignInForm, safeNextPath } from '@/features/accounts';
import { AUTH_LINK, AuthLayout } from './AuthLayout';

/** What another page hands over when it sends someone here. */
interface SignInState {
  sessionEnded?: boolean;
  /** Set by the registration page, with the new account's email. */
  registered?: boolean;
  email?: string;
}

export function SignInPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const location = useLocation();
  const next = safeNextPath(params.get('next'));
  const state = location.state as SignInState | null;
  const sessionEnded = state?.sessionEnded === true;
  const registered = state?.registered === true;

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
      {registered && (
        <p role="status" className="rounded-control bg-success-soft px-3 py-2 text-sm text-success">
          Your account is ready. Sign in.
        </p>
      )}
      <SignInForm
        defaultEmail={registered ? state?.email : undefined}
        onSignedIn={() => navigate(next, { replace: true })}
      />
    </AuthLayout>
  );
}
