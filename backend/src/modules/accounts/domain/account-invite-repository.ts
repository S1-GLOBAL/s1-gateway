import type { Result } from '../../../shared/domain/result.js';
import type { Account } from './account.js';
import type { AccountInvite } from './account-invite.js';
import type { AccountExistsError, InviteInvalidError, InviteNotFoundError } from './account.errors.js';

/** Where invites are kept. The domain owns this port; infrastructure implements it. */
export interface AccountInviteRepository {
  /**
   * Adds the invite and, in the same transaction, revokes every unused,
   * unrevoked invite to the same email: inviting again replaces the old link.
   */
  add(invite: AccountInvite): Promise<void>;

  findByTokenHash(tokenHash: string): Promise<AccountInvite | null>;

  /** Every invite usable at `now`, newest first. */
  listOpen(now: Date): Promise<AccountInvite[]>;

  /** Revokes an unused, unrevoked invite. A used, revoked or unknown one fails with InviteNotFoundError. */
  revoke(id: string, now: Date): Promise<Result<AccountInvite, InviteNotFoundError>>;

  /**
   * Adds the account and marks the invite used, in one transaction. When the
   * invite is no longer usable at `now` it fails with InviteInvalidError and
   * adds nothing, so of two registrations racing on one invite exactly one
   * wins. When the email already has an account it fails with
   * AccountExistsError and leaves the invite unused.
   */
  redeem(inviteId: string, account: Account, now: Date): Promise<Result<void, InviteInvalidError | AccountExistsError>>;
}
