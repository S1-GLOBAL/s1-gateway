import { useNavigate, useSearchParams } from 'react-router-dom';
import { isInviteInvalid, RegisterForm, useInvite, type Account } from '@/features/accounts';
import { Button } from '@/shared/ui/Button';
import { AuthLayout } from './AuthLayout';
import { AuthPageSkeleton } from './AuthPageSkeleton';

/** `/register?token=…`: the page an invite link opens. Public. */
export function RegisterPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  if (!token) return <InviteNoLongerWorks />;
  return <Registration token={token} />;
}

function Registration({ token }: { token: string }) {
  const navigate = useNavigate();
  // Not a suspense query: a link that no longer works is a state of this
  // page, not a failure for the route's error boundary.
  const invite = useInvite(token);

  if (invite.isPending) return <AuthPageSkeleton />;

  if (invite.isError) {
    if (isInviteInvalid(invite.error)) return <InviteNoLongerWorks />;
    return (
      <AuthLayout title="Create your account">
        <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
          {invite.error.message}
        </p>
        <Button variant="secondary" onClick={() => void invite.refetch()} className="w-full">
          Try again
        </Button>
      </AuthLayout>
    );
  }

  function registered(account: Account) {
    navigate('/sign-in', { replace: true, state: { registered: true, email: account.email } });
  }

  return (
    <AuthLayout title="Create your account" description="You were invited to the Source One Gateway.">
      <RegisterForm token={token} email={invite.data.email} onRegistered={registered} />
    </AuthLayout>
  );
}

function InviteNoLongerWorks() {
  return (
    <AuthLayout
      title="This invite link no longer works."
      description="It may have expired, been used or been revoked. Ask a Gateway admin for a new one."
    />
  );
}
