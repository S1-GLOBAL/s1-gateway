import { useState, type FormEvent } from 'react';
import { Button } from '@/shared/ui/Button';
import { TextField } from '@/shared/ui/TextField';
import { useCreateInvite } from '../application/use-create-invite';
import type { CreatedInvite } from '../domain/account';
import { fieldErrors, formMessage } from './form-errors';
import { FormAlert } from './FormAlert';

/** One email, and a link back for the admin to send. The caller shows the link. */
export function InviteForm({ onCreated }: { onCreated(created: CreatedInvite): void }) {
  const [email, setEmail] = useState('');
  const createInvite = useCreateInvite();
  const error = createInvite.error;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createInvite.mutate(email, { onSuccess: onCreated });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="off"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        errors={fieldErrors(error, 'email')}
        hint="Their @sourceone.global address."
        required
      />
      <FormAlert message={formMessage(error, 'email')} />
      <Button type="submit" loading={createInvite.isPending} className="w-full">
        Create invite link
      </Button>
    </form>
  );
}
