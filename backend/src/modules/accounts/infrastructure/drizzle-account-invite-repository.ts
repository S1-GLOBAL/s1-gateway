import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import type { Database } from '../../../shared/infrastructure/database/connection.js';
import { isUniqueViolation } from '../../../shared/infrastructure/database/postgres-errors.js';
import type { Account } from '../domain/account.js';
import { AccountExistsError, InviteInvalidError, InviteNotFoundError } from '../domain/account.errors.js';
import type { AccountInvite } from '../domain/account-invite.js';
import type { AccountInviteRepository } from '../domain/account-invite-repository.js';
import { toRow as toAccountRow } from './account.mapper.js';
import { toDomain, toRow } from './account-invite.mapper.js';
import { accountInvites, accounts } from './accounts.table.js';

/** Thrown inside a transaction to roll it back when the invite is no longer usable. */
class InviteNoLongerUsable extends Error {}

/** Neither used nor revoked: the invites an admin can still revoke, or a new invite replaces. */
const isOpen = and(isNull(accountInvites.usedAt), isNull(accountInvites.revokedAt));

export class DrizzleAccountInviteRepository implements AccountInviteRepository {
  constructor(private readonly db: Database) {}

  async add(invite: AccountInvite): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(accountInvites)
        .set({ revokedAt: invite.createdAt })
        .where(and(eq(accountInvites.email, invite.email), isOpen));
      await tx.insert(accountInvites).values(toRow(invite));
    });
  }

  async findByTokenHash(tokenHash: string): Promise<AccountInvite | null> {
    const [row] = await this.db.select().from(accountInvites).where(eq(accountInvites.tokenHash, tokenHash));
    return row ? toDomain(row) : null;
  }

  async listOpen(now: Date): Promise<AccountInvite[]> {
    const rows = await this.db
      .select()
      .from(accountInvites)
      .where(and(isOpen, gt(accountInvites.expiresAt, now)))
      .orderBy(desc(accountInvites.createdAt), desc(accountInvites.id));
    return rows.map(toDomain);
  }

  async revoke(id: string, now: Date): Promise<Result<AccountInvite, InviteNotFoundError>> {
    // Conditional, so a revoke racing a registration or another revoke finds
    // the invite gone rather than overwriting what happened to it.
    const [row] = await this.db
      .update(accountInvites)
      .set({ revokedAt: now })
      .where(and(eq(accountInvites.id, id), isOpen))
      .returning();
    return row ? ok(toDomain(row)) : err(new InviteNotFoundError());
  }

  async redeem(
    inviteId: string,
    account: Account,
    now: Date,
  ): Promise<Result<void, InviteInvalidError | AccountExistsError>> {
    try {
      await this.db.transaction(async (tx) => {
        // The invite first: a second registration on the same token waits on
        // this row's lock, then finds it used and updates nothing.
        const used = await tx
          .update(accountInvites)
          .set({ usedAt: now })
          .where(and(eq(accountInvites.id, inviteId), isOpen, gt(accountInvites.expiresAt, now)))
          .returning({ id: accountInvites.id });
        if (used.length === 0) throw new InviteNoLongerUsable();
        await tx.insert(accounts).values(toAccountRow(account));
      });
      return ok(undefined);
    } catch (error) {
      if (error instanceof InviteNoLongerUsable) return err(new InviteInvalidError());
      // The account insert failing rolls back the invite update: it stays unused.
      if (isUniqueViolation(error)) return err(new AccountExistsError());
      throw error;
    }
  }
}
