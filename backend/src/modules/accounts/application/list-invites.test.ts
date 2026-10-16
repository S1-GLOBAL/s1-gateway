import { describe, expect, it } from 'vitest';
import { FixedClock } from '../../../shared/application/testing/fakes.js';
import { AccountInvite, INVITE_TTL_MS } from '../domain/account-invite.js';
import { InMemoryAccountInviteRepository } from './testing/in-memory-account-invite-repository.js';
import { InMemoryAccountRepository } from './testing/in-memory-account-repository.js';
import { ListInvites } from './list-invites.js';

const NOW = new Date('2026-10-17T09:00:00.000Z');
const ADMIN_ID = '00000000-0000-4000-8000-0000000000aa';
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 60 * 60 * 1000);

function invite(n: number, createdAt: Date) {
  return AccountInvite.create(`person${n}@sourceone.global`, `hash(token-${n})`, ADMIN_ID, `invite-${n}`, createdAt);
}

describe('ListInvites', () => {
  it('is empty before anything is added', async () => {
    const invites = new InMemoryAccountInviteRepository(new InMemoryAccountRepository());
    expect(await new ListInvites(invites, new FixedClock(NOW)).execute()).toEqual([]);
  });

  it('lists only unused, unrevoked, unexpired invites, newest first', async () => {
    const invites = new InMemoryAccountInviteRepository(new InMemoryAccountRepository());
    await invites.add(invite(1, hoursAgo(3)));
    await invites.add(invite(2, hoursAgo(1)));
    await invites.add(invite(3, hoursAgo(2)).use(hoursAgo(1)));
    await invites.add(invite(4, hoursAgo(2)).revoke(hoursAgo(1)));
    await invites.add(invite(5, new Date(NOW.getTime() - INVITE_TTL_MS)));

    const result = await new ListInvites(invites, new FixedClock(NOW)).execute();

    expect(result).toEqual([
      {
        id: 'invite-2',
        email: 'person2@sourceone.global',
        expiresAt: new Date(hoursAgo(1).getTime() + INVITE_TTL_MS).toISOString(),
      },
      {
        id: 'invite-1',
        email: 'person1@sourceone.global',
        expiresAt: new Date(hoursAgo(3).getTime() + INVITE_TTL_MS).toISOString(),
      },
    ]);
  });
});
