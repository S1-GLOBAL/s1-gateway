import { useNavigate } from 'react-router-dom';
import { ChangePasswordForm, useMe } from '@/features/accounts';
import { AuthLayout } from './AuthLayout';

/** Signed-in, but outside the shell: someone who must change their password sees nothing else. */
export function ChangePasswordPage() {
  const navigate = useNavigate();
  const { data: me } = useMe();

  return (
    <AuthLayout
      title="Change your password"
      description={me.mustChangePassword ? 'Choose a new password before you continue.' : 'Choose a new password for your account.'}
    >
      <ChangePasswordForm onChanged={() => navigate('/', { replace: true })} />
    </AuthLayout>
  );
}