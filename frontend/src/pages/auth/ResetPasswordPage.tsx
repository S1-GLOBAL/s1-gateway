import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ResetPasswordForm } from '@/features/accounts';
import { AUTH_LINK, AuthLayout } from './AuthLayout';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token');

  const footer = (
    <Link to="/sign-in" className={AUTH_LINK}>
      Back to sign in
    </Link>
  );

  if (!token) {
    return (
      <AuthLayout title="Reset your password" footer={footer}>
        <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
          This link is invalid or has expired. Ask reyxdz for a new one.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Reset your password" description="Choose a new password for your account." footer={footer}>
      <ResetPasswordForm token={token} onReset={() => navigate('/sign-in', { replace: true })} />
    </AuthLayout>
  );
}