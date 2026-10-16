import { useState, type FormEvent } from 'react';
import { Button } from '@/shared/ui/Button';
import { TextField } from '@/shared/ui/TextField';
import { useSignUp } from '../application/use-sign-up';
import { fieldErrors, formMessage } from './form-errors';
import { FormAlert } from './FormAlert';

export function SignUpForm({ onSignedUp }: { onSignedUp(): void }) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const signUp = useSignUp();
  const error = signUp.error;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    signUp.mutate({ email, fullName, password }, { onSuccess: onSignedUp });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="username"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        errors={fieldErrors(error, 'email')}
        hint="Your @sourceone.global address."
        required
      />
      <TextField
        label="Full name"
        name="fullName"
        autoComplete="name"
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
        errors={fieldErrors(error, 'fullName')}
        hint="First and last name."
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
      <FormAlert message={formMessage(error, 'email', 'fullName', 'password')} />
      <Button type="submit" loading={signUp.isPending} className="w-full">
        Create account
      </Button>
    </form>
  );
}