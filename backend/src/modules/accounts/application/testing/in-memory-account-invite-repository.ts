import { err, ok, type Result } from '../../../../shared/domain/result.js';
import type { Account } from '../../domain/account.js';
import { type AccountExistsError, InviteInvalidError, InviteNotFoundError } from '../../domain/account.errors.js';
import type { AccountInvite } from '../../domain/account-invite.js';
import type { AccountInviteRepository } from '../../domain/account-invite-repository.js';
import type { AccountRepository } from '../../domain/account-repository.js';

/**
 * The AccountInviteRepository contract, in memory. A test double, never used
 * in production. Redeeming adds the account to the account repository it is
 * given, as the real one inserts into the same database.
 */
export class InMemoryAccountInviteRepository implements AccountInviteRepository {
  private readonly invites: AccountInvite[] = [];

  constructor(private readonly accounts: AccountRepository) {}

  async add(invite: AccountInvite): Promise<void> {
    this.invites.forEach((existing, index) => {
      if (existing.email === invite.email && isOpen(existing)) {
        this.invites[index] = existing.revoke(invite.createdAt);
      }
    });
    this.invites.push(invite);
  }

  async findByTokenHash(tokenHash: string): Promise<AccountInvite | null> {
    return this.invites.find((invite) => invite.tokenHash === tokenHash) ?? null;
  }

  async listOpen(now: Date): Promise<AccountInvite[]> {
    return this.invites
      .filter((invite) => invite.isUsable(now))
      // The later of two created at one instant first: the sort keeps this order for ties.
      .reverse()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async revoke(id: string, now: Date): Promise<Result<AccountInvite, InviteNotFoundError>> {
    const index = this.invites.findIndex((invite) => invite.id === id && isOpen(invite));
    const invite = this.invites[index];
    if (!invite) return err(new InviteNotFoundError());
    const revoked = invite.revoke(now);
    this.invites[index] = revoked;
    return ok(revoked);
  }

  async redeem(
    inviteId: string,
    account: Account,
    now: Date,
  ): Promise<Result<void, InviteInvalidError | AccountExistsError>> {
    const index = this.invites.findIndex((invite) => invite.id === inviteId);
    const invite = this.invites[index];
    if (!invite || !invite.isUsable(now)) return err(new InviteInvalidError());
    const added = await this.accounts.add(account);
    if (!added.ok) return added;
    this.invites[index] = invite.use(now);
    return ok(undefined);
  }
}

function isOpen(invite: AccountInvite): boolean {
  return invite.usedAt === null && invite.revokedAt === null;
}
