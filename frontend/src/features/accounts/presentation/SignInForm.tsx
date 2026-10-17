import { useState, type FormEvent } from 'react';
import { Button } from '@/shared/ui/Button';
import { TextField } from '@/shared/ui/TextField';
import { useSignIn } from '../application/use-sign-in';
import { fieldErrors, formMessage } from './form-errors';
import { FormAlert } from './FormAlert';

export interface SignInFormProps {
  /** The email to start with: the account just registered. */
  defaultEmail?: string;
  onSignedIn(): void;
}

export function SignInForm({ defaultEmail = '', onSignedIn }: SignInFormProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState('');
  const signIn = useSignIn();
  const error = signIn.error;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    signIn.mutate({ email, password }, { onSuccess: onSignedIn });
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
        required
      />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        errors={fieldErrors(error, 'password')}
        required
      />
      <FormAlert message={formMessage(error, 'email', 'password')} />
      <Button type="submit" loading={signIn.isPending} className="w-full">
        Sign in
      </Button>
    </form>
  );
}