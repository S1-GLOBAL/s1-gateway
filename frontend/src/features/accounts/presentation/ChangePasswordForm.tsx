import { useState, type FormEvent } from 'react';
import { Button } from '@/shared/ui/Button';
import { TextField } from '@/shared/ui/TextField';
import { useChangePassword } from '../application/use-change-password';
import { fieldErrors, formMessage } from './form-errors';
import { FormAlert } from './FormAlert';

export function ChangePasswordForm({ onChanged }: { onChanged(): void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const changePassword = useChangePassword();
  const error = changePassword.error;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    changePassword.mutate({ currentPassword, newPassword }, { onSuccess: onChanged });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <TextField
        label="Current password"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        value={currentPassword}
        onChange={(event) => setCurrentPassword(event.target.value)}
        errors={fieldErrors(error, 'currentPassword')}
        required
      />
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
      <FormAlert message={formMessage(error, 'currentPassword', 'newPassword', 'password')} />
      <Button type="submit" loading={changePassword.isPending} className="w-full">
        Change password
      </Button>
    </form>
  );
}