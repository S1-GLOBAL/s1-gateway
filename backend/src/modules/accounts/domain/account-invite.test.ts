import { describe, expect, it } from 'vitest';
import { AccountInvite, INVITE_TTL_MS } from './account-invite.js';

const CREATED_AT = new Date('2026-10-17T08:00:00.000Z');
const EXPIRES_AT = new Date(CREATED_AT.getTime() + INVITE_TTL_MS);

function invite() {
  return AccountInvite.create('ada@sourceone.global', 'hash(token-1)', 'admin-1', 'invite-1', CREATED_AT);
}

describe('AccountInvite', () => {
  it('lasts 7 days, unused and unrevoked', () => {
    const created = invite();
    expect(INVITE_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(created.expiresAt.toISOString()).toBe('2026-10-24T08:00:00.000Z');
    expect(created.usedAt).toBeNull();
    expect(created.revokedAt).toBeNull();
    expect(created.invitedBy).toBe('admin-1');
  });

  it('is usable before it expires', () => {
    expect(invite().isUsable(new Date(EXPIRES_AT.getTime() - 1))).toBe(true);
  });

  it('is not usable at or after it expires', () => {
    expect(invite().isUsable(EXPIRES_AT)).toBe(false);
    expect(invite().isUsable(new Date(EXPIRES_AT.getTime() + 1))).toBe(false);
  });

  it('is not usable once used', () => {
    expect(invite().use(CREATED_AT).isUsable(CREATED_AT)).toBe(false);
  });

  it('is not usable once revoked', () => {
    const revoked = invite().revoke(CREATED_AT);
    expect(revoked.revokedAt?.toISOString()).toBe(CREATED_AT.toISOString());
    expect(revoked.isUsable(CREATED_AT)).toBe(false);
  });
});
