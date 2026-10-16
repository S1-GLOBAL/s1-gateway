import { useState, type FormEvent } from 'react';
import { Button } from '@/shared/ui/Button';
import { TextField } from '@/shared/ui/TextField';
import { useResetPassword } from '../application/use-reset-password';
import { fieldErrors, formMessage } from './form-errors';
import { FormAlert } from './FormAlert';

export function ResetPasswordForm({ token, onReset }: { token: string; onReset(): void }) {
  const [newPassword, setNewPassword] = useState('');
  const resetPassword = useResetPassword();
  const error = resetPassword.error;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetPassword.mutate({ token, newPassword }, { onSuccess: onReset });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <TextField
        label="New password"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
        errors={fieldErrors(error, 'newPassword', 'password')}
        hint="At least 12 characters."
        required
      />
      <FormAlert message={formMessage(error, 'newPassword', 'password')} />
      <Button type="submit" loading={resetPassword.isPending} className="w-full">
        Set new password
      </Button>
    </form>
  );
}