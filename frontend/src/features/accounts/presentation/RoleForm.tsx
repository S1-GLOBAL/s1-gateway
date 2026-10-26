import { useState, type FormEvent } from 'react';
import { Button } from '@/shared/ui/Button';
import { SelectField } from '@/shared/ui/SelectField';
import { useSetAccountRole } from '../application/use-set-account-role';
import { ROLE_LABELS, type Account, type AccountRole } from '../domain/account';
import { FormAlert } from './FormAlert';

const ROLES: readonly AccountRole[] = ['staff', 'admin', 'system-admin'];

const WHAT_EACH_MAY_DO: Record<AccountRole, string> = {
  staff: 'Uses the Gateway, and nothing more.',
  admin: 'Also invites people, and approves, disables and resets staff.',
  'system-admin': "Also manages admins and System Admins, and changes anyone's role.",
};

/** One account's role, for a System Admin to change. The caller says what changed. */
export function RoleForm({ account, onChanged }: { account: Account; onChanged(changed: Account): void }) {
  const [role, setRole] = useState<AccountRole>(account.role);
  const setAccountRole = useSetAccountRole();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAccountRole.mutate({ id: account.id, role }, { onSuccess: onChanged });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <SelectField
        label="Role"
        name="role"
        value={role}
        onChange={(event) => setRole(event.target.value as AccountRole)}
        options={ROLES.map((value) => ({ value, label: ROLE_LABELS[value] }))}
        hint={WHAT_EACH_MAY_DO[role]}
      />
      <FormAlert message={setAccountRole.error?.message} />
      <Button
        type="submit"
        loading={setAccountRole.isPending}
        disabled={role === account.role}
        className="w-full"
      >
        Save role
      </Button>
    </form>
  );
}
