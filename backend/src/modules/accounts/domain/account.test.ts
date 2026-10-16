import { describe, expect, it } from 'vitest';
import { FixedClock } from '../../../shared/application/testing/fakes.js';
import { Account } from './account.js';

const createdAt = new Date('2026-10-16T00:00:00.000Z');
const id = '00000000-0000-4000-8000-000000000001';

function pendingAccount() {
  const result = Account.register(
    {
      email: 'staff@sourceone.global',
      fullName: 'Staff Member',
      passwordHash: 'hash',
      autoApprove: false,
    },
    id,
    createdAt,
  );
  if (!result.ok) throw new Error('setup failed');
  return result.value;
}

describe('Account', () => {
  it('registers as pending by default', () => {
    const account = pendingAccount();
    expect(account.status).toBe('pending');
    expect(account.approvedAt).toBeNull();
    expect(account.approvedBy).toBeNull();
  });

  it('auto-approves when the email is an admin', () => {
    const result = Account.register(
      {
        email: 'admin@sourceone.global',
        fullName: 'Admin',
        passwordHash: 'hash',
        autoApprove: true,
      },
      id,
      createdAt,
    );
    expect(result.ok && result.value.status).toBe('approved');
    expect(result.ok && result.value.approvedBy).toBe(id);
    expect(result.ok && result.value.approvedAt?.toISOString()).toBe(createdAt.toISOString());
  });

  it('locks after the fifth failed sign-in', () => {
    const clock = new FixedClock(new Date('2026-10-16T12:00:00.000Z'));
    let account = pendingAccount().approve(id, createdAt);
    for (let i = 0; i < 4; i += 1) {
      account = account.recordFailedSignIn(clock.now());
      expect(account.isLocked(clock.now())).toBe(false);
    }
    account = account.recordFailedSignIn(clock.now());
    expect(account.isLocked(clock.now())).toBe(true);
    expect(account.lockedUntil?.toISOString()).toBe('2026-10-16T12:15:00.000Z');
  });

  it('clears lockout after fifteen minutes', () => {
    const lockedAt = new Date('2026-10-16T12:00:00.000Z');
    let account = pendingAccount().approve(id, createdAt);
    for (let i = 0; i < 5; i += 1) account = account.recordFailedSignIn(lockedAt);
    expect(account.isLocked(new Date('2026-10-16T12:14:59.000Z'))).toBe(true);
    expect(account.isLocked(new Date('2026-10-16T12:15:00.000Z'))).toBe(false);
  });

  it('resets the failure count on a successful sign-in', () => {
    let account = pendingAccount().approve(id, createdAt);
    account = account.recordFailedSignIn(createdAt);
    account = account.recordSuccessfulSignIn();
    expect(account.failedSignInCount).toBe(0);
    expect(account.lockedUntil).toBeNull();
  });
});
