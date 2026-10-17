import { describe, expect, it } from 'vitest';
import { FixedClock } from '../../../shared/application/testing/fakes.js';
import { InviteNotFoundError } from '../domain/account.errors.js';
import { AccountInvite } from '../domain/account-invite.js';
import { InMemoryAccountInviteRepository } from './testing/in-memory-account-invite-repository.js';
import { InMemoryAccountRepository } from './testing/in-memory-account-repository.js';
import { RevokeInvite } from './revoke-invite.js';

const CREATED_AT = new Date('2026-10-17T08:00:00.000Z');
const NOW = new Date('2026-10-17T09:00:00.000Z');

async function setup(prepare: (invite: AccountInvite) => AccountInvite = (invite) => invite) {
  const invites = new InMemoryAccountInviteRepository(new InMemoryAccountRepository());
  const created = AccountInvite.create('ada@sourceone.global', 'hash(token-1)', 'admin-1', 'invite-1', CREATED_AT);
  await invites.add(prepare(created));
  return { invites, revokeInvite: new RevokeInvite(invites, new FixedClock(NOW)) };
}

describe('RevokeInvite', () => {
  it('revokes an open invite, so its link stops working', async () => {
    const { invites, revokeInvite } = await setup();
    const result = await revokeInvite.execute({ inviteId: 'invite-1' });

    expect(result).toEqual({
      ok: true,
      value: { id: 'invite-1', email: 'ada@sourceone.global', expiresAt: '2026-10-24T08:00:00.000Z' },
    });
    const stored = await invites.findByTokenHash('hash(token-1)');
    expect(stored?.revokedAt?.toISOString()).toBe(NOW.toISOString());
    expect(stored?.isUsable(NOW)).toBe(false);
  });

  it('refuses a used invite', async () => {
    const { revokeInvite } = await setup((invite) => invite.use(CREATED_AT));
    const result = await revokeInvite.execute({ inviteId: 'invite-1' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(InviteNotFoundError);
      expect(result.error.code).toBe('INVITE_NOT_FOUND');
      expect(result.error.message).toBe('This invite was already used or revoked.');
    }
  });

  it('refuses an invite already revoked', async () => {
    const { revokeInvite } = await setup((invite) => invite.revoke(CREATED_AT));
    const result = await revokeInvite.execute({ inviteId: 'invite-1' });
    expect(!result.ok && result.error).toBeInstanceOf(InviteNotFoundError);
  });

  it('refuses an unknown invite', async () => {
    const { revokeInvite } = await setup();
    const result = await revokeInvite.execute({ inviteId: 'invite-unknown' });
    expect(!result.ok && result.error).toBeInstanceOf(InviteNotFoundError);
  });
});
