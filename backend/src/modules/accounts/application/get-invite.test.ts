import { describe, expect, it } from 'vitest';
import { FixedClock } from '../../../shared/application/testing/fakes.js';
import { InviteInvalidError } from '../domain/account.errors.js';
import { AccountInvite, INVITE_TTL_MS } from '../domain/account-invite.js';
import { InMemoryAccountInviteRepository } from './testing/in-memory-account-invite-repository.js';
import { InMemoryAccountRepository } from './testing/in-memory-account-repository.js';
import { FakeTokenGenerator } from './testing/fake-token-generator.js';
import { GetInvite } from './get-invite.js';

const CREATED_AT = new Date('2026-10-17T08:00:00.000Z');
const EXPIRES_AT = new Date(CREATED_AT.getTime() + INVITE_TTL_MS);

async function setup(now: Date, prepare: (invite: AccountInvite) => AccountInvite = (invite) => invite) {
  const invites = new InMemoryAccountInviteRepository(new InMemoryAccountRepository());
  const created = AccountInvite.create('ada@sourceone.global', 'hash(token-1)', 'admin-1', 'invite-1', CREATED_AT);
  await invites.add(prepare(created));
  return new GetInvite(invites, new FakeTokenGenerator(), new FixedClock(now));
}

describe('GetInvite', () => {
  it('reads a usable invite: its email and when it expires', async () => {
    const getInvite = await setup(CREATED_AT);
    expect(await getInvite.execute({ token: 'token-1' })).toEqual({
      ok: true,
      value: { email: 'ada@sourceone.global', expiresAt: EXPIRES_AT.toISOString() },
    });
  });

  it('answers the same for an expired, used, revoked or unknown token', async () => {
    const expired = await setup(EXPIRES_AT);
    const used = await setup(CREATED_AT, (invite) => invite.use(CREATED_AT));
    const revoked = await setup(CREATED_AT, (invite) => invite.revoke(CREATED_AT));
    const unknown = await setup(CREATED_AT);

    for (const result of [
      await expired.execute({ token: 'token-1' }),
      await used.execute({ token: 'token-1' }),
      await revoked.execute({ token: 'token-1' }),
      await unknown.execute({ token: 'not-a-token' }),
    ]) {
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(InviteInvalidError);
        expect(result.error.code).toBe('INVITE_INVALID');
        expect(result.error.message).toBe('This invite link no longer works.');
      }
    }
  });
});
