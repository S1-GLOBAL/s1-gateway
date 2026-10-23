import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useDoorHold } from '@/app/shell/door-hold';
import { WELCOME_INTO_HUB } from '@/app/shell/door-stage';
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
  useDoorHold(false);

  return (
    <AuthLayout
      title="Sign in"
      description="Use your Source One email and password."
      footer={
        <Link to="/" className={AUTH_LINK}>
          Back
        </Link>
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
        onSignedIn={() => navigate(next === '/' ? '/atlas' : next, { replace: true, state: WELCOME_INTO_HUB })}
      />
    </AuthLayout>
  );
}
