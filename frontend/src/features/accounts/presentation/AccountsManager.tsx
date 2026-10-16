import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { useApproveAccount } from '../application/use-approve-account';
import { useCreatePasswordResetLink } from '../application/use-create-password-reset-link';
import { useDisableAccount } from '../application/use-disable-account';
import { useListAccounts } from '../application/use-list-accounts';
import { useMe } from '../application/use-me';
import type { Account } from '../domain/account';
import { AccountSection } from './AccountSection';
import { FormAlert } from './FormAlert';
import { ResetLinkNotice } from './ResetLinkNotice';

/** Pending, approved and disabled accounts, and what an admin can do to each. Admin only. */
export function AccountsManager() {
  const { data: me } = useMe();
  const { data: lists } = useListAccounts();
  const approve = useApproveAccount();
  const disable = useDisableAccount();
  const createLink = useCreatePasswordResetLink();

  const [notice, setNotice] = useState<string | null>(null);
  const [link, setLink] = useState<{ name: string; url: string } | null>(null);
  const [failure, setFailure] = useState<string | undefined>();

  const busy = approve.isPending || disable.isPending || createLink.isPending;

  function begin() {
    setNotice(null);
    setLink(null);
    setFailure(undefined);
  }

  function approveAccount(account: Account) {
    begin();
    approve.mutate(account.id, {
      onSuccess: () => setNotice(`${account.fullName} can now sign in.`),
      onError: (error) => setFailure(error.message),
    });
  }

  function disableAccount(account: Account) {
    begin();
    disable.mutate(account.id, {
      onSuccess: () => setNotice(`${account.fullName} can no longer sign in, and any open session has ended.`),
      onError: (error) => setFailure(error.message),
    });
  }

  function resetPassword(account: Account) {
    begin();
    createLink.mutate(account.id, {
      onSuccess: (result) => setLink({ name: account.fullName, url: result.resetUrl }),
      onError: (error) => setFailure(error.message),
    });
  }

  return (
    <div className="flex flex-col gap-10">
      {notice && (
        <p role="status" className="rounded-control bg-success-soft px-3 py-2 text-sm text-success">
          {notice}
        </p>
      )}
      {link && <ResetLinkNotice name={link.name} url={link.url} onDismiss={() => setLink(null)} />}
      <FormAlert message={failure} />

      <AccountSection
        id="pending"
        title="Pending"
        empty="No accounts are waiting for approval."
        accounts={lists.pending}
        actions={(account) => (
          <Button size="sm" disabled={busy} onClick={() => approveAccount(account)}>
            Approve
          </Button>
        )}
      />
      <AccountSection
        id="approved"
        title="Approved"
        empty="No approved accounts."
        accounts={lists.approved}
        actions={(account) => (
          <>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => resetPassword(account)}>
              Reset password
            </Button>
            {account.id !== me.id && (
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => disableAccount(account)}>
                Disable
              </Button>
            )}
          </>
        )}
      />
      <AccountSection
        id="disabled"
        title="Disabled"
        empty="No disabled accounts."
        accounts={lists.disabled}
        actions={(account) => (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => approveAccount(account)}>
            Approve again
          </Button>
        )}
      />
    </div>
  );
}