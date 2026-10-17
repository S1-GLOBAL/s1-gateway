import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Sheet } from '@/shared/ui/Sheet';
import { useApproveAccount } from '../application/use-approve-account';
import { useCreatePasswordResetLink } from '../application/use-create-password-reset-link';
import { useDisableAccount } from '../application/use-disable-account';
import { useInvites } from '../application/use-invites';
import { useListAccounts } from '../application/use-list-accounts';
import { useMe } from '../application/use-me';
import { useRevokeInvite } from '../application/use-revoke-invite';
import type { Account, AccountInvite, CreatedInvite } from '../domain/account';
import { AccountSection } from './AccountSection';
import { FormAlert } from './FormAlert';
import { InvitedSection } from './InvitedSection';
import { InviteForm } from './InviteForm';
import { LinkNotice, type LinkNoticeProps } from './LinkNotice';

export interface AccountsManagerProps {
  /** Whether the Invite form is open. The page's Invite button opens it. */
  inviting: boolean;
  onInvitingEnd(): void;
  /** For the invites' expiry days: the viewer's own when left out. */
  timeZone?: string;
}

/** Invites, and pending, approved and disabled accounts, and what an admin can do to each. Admin only. */
export function AccountsManager({ inviting, onInvitingEnd, timeZone }: AccountsManagerProps) {
  const { data: me } = useMe();
  const { data: lists } = useListAccounts();
  const { data: invites } = useInvites();
  const approve = useApproveAccount();
  const disable = useDisableAccount();
  const createLink = useCreatePasswordResetLink();
  const revoke = useRevokeInvite();

  const [notice, setNotice] = useState<string | null>(null);
  const [link, setLink] = useState<Omit<LinkNoticeProps, 'onDismiss'> | null>(null);
  const [failure, setFailure] = useState<string | undefined>();

  const busy = approve.isPending || disable.isPending || createLink.isPending || revoke.isPending;

  function begin() {
    setNotice(null);
    setLink(null);
    setFailure(undefined);
  }

  function invited({ invite, inviteUrl }: CreatedInvite) {
    onInvitingEnd();
    begin();
    setLink({
      lead: `Invite link for ${invite.email}`,
      url: inviteUrl,
      instructions: 'Send it to them; it works once and expires in 7 days.',
    });
  }

  function revokeInvite(invite: AccountInvite) {
    begin();
    revoke.mutate(invite.id, {
      onSuccess: () => setNotice(`The invite for ${invite.email} no longer works.`),
      onError: (error) => setFailure(error.message),
    });
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
      onSuccess: (result) =>
        setLink({
          lead: `Password reset link for ${account.fullName}`,
          url: result.resetUrl,
          instructions: 'Give it to them in person; it works once and expires in 24 hours.',
        }),
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
      {link && <LinkNotice {...link} onDismiss={() => setLink(null)} />}
      <FormAlert message={failure} />

      <InvitedSection invites={invites} busy={busy} onRevoke={revokeInvite} timeZone={timeZone} />
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

      <Sheet open={inviting} onClose={onInvitingEnd} title="Invite">
        {/* Mounted only while open, so each opening starts from an empty form. */}
        {inviting && <InviteForm onCreated={invited} />}
      </Sheet>
    </div>
  );
}
