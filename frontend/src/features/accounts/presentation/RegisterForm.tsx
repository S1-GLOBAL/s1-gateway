import { useState, type FormEvent } from 'react';
import { Button } from '@/shared/ui/Button';
import { TextField } from '@/shared/ui/TextField';
import { useRegister } from '../application/use-register';
import type { Account } from '../domain/account';
import { fieldErrors, formMessage } from './form-errors';
import { FormAlert } from './FormAlert';

const PASSWORDS_DIFFER = "The passwords don't match.";

export interface RegisterFormProps {
  token: string;
  /** The invite's email: shown, never edited, never sent. */
  email: string;
  onRegistered(account: Account): void;
}

export function RegisterForm({ token, email, onRegistered }: RegisterFormProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordsDiffer, setPasswordsDiffer] = useState(false);
  const register = useRegister();
  const error = register.error;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Said before sending; the server checks it again.
    if (password !== confirmPassword) {
      register.reset();
      setPasswordsDiffer(true);
      return;
    }
    setPasswordsDiffer(false);
    register.mutate({ token, firstName, lastName, password, confirmPassword }, { onSuccess: onRegistered });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <dl className="flex flex-col gap-1.5">
        <dt className="text-sm font-medium text-ink">Email</dt>
        <dd className="font-mono text-sm break-all text-ink">{email}</dd>
      </dl>
      <TextField
        label="First name"
        name="firstName"
        autoComplete="given-name"
        value={firstName}
        onChange={(event) => setFirstName(event.target.value)}
        errors={fieldErrors(error, 'firstName')}
        required
      />
      <TextField
        label="Last name"
        name="lastName"
        autoComplete="family-name"
        value={lastName}
        onChange={(event) => setLastName(event.target.value)}
        errors={fieldErrors(error, 'lastName')}
        required
      />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        errors={fieldErrors(error, 'password')}
        hint="At least 12 characters."
        required
      />
      <TextField
        label="Confirm password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        errors={passwordsDiffer ? [PASSWORDS_DIFFER] : fieldErrors(error, 'confirmPassword')}
        required
      />
      <FormAlert message={formMessage(error, 'firstName', 'lastName', 'password', 'confirmPassword')} />
      <Button type="submit" loading={register.isPending} className="w-full">
        Create account
      </Button>
    </form>
  );
}
