import { describe, expect, it } from 'vitest';
import { FixedClock } from '../../../shared/application/testing/fakes.js';
import { Account, type AccountRole } from './account.js';

const createdAt = new Date('2026-10-16T00:00:00.000Z');
const id = '00000000-0000-4000-8000-000000000001';

function pendingAccount() {
  const result = Account.register(
    {
      email: 'staff@sourceone.global',
      firstName: 'Staff',
      lastName: 'Member',
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
        firstName: 'Admin',
        lastName: '',
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

  it('shows its name as "First Last"', () => {
    expect(pendingAccount().fullName).toBe('Staff Member');
  });

  it('shows a name with no last name without a trailing space', () => {
    const result = Account.register(
      { email: 'admin@sourceone.global', firstName: 'Admin', lastName: '', passwordHash: 'hash', autoApprove: true },
      id,
      createdAt,
    );
    expect(result.value.fullName).toBe('Admin');
  });

  it('registers an invited account as approved by whoever invited it', () => {
    const account = Account.registerInvited(
      {
        email: 'ada@sourceone.global',
        firstName: 'Ada',
        lastName: 'Lovelace',
        passwordHash: 'hash',
        invitedBy: '00000000-0000-4000-8000-0000000000aa',
      },
      id,
      createdAt,
    );
    expect(account.status).toBe('approved');
    expect(account.approvedBy).toBe('00000000-0000-4000-8000-0000000000aa');
    expect(account.approvedAt?.toISOString()).toBe(createdAt.toISOString());
    expect(account.mustChangePassword).toBe(false);
    expect(account.firstName).toBe('Ada');
    expect(account.lastName).toBe('Lovelace');
    expect(account.fullName).toBe('Ada Lovelace');
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

  it('starts a fresh failure count after the lock window ends', () => {
    const lockedAt = new Date('2026-10-16T12:00:00.000Z');
    const afterLock = new Date('2026-10-16T12:15:00.000Z');
    let account = pendingAccount().approve(id, createdAt);
    for (let i = 0; i < 5; i += 1) account = account.recordFailedSignIn(lockedAt);
    account = account.recordFailedSignIn(afterLock);
    expect(account.failedSignInCount).toBe(1);
    expect(account.isLocked(afterLock)).toBe(false);
  });

  it('resets the failure count on a successful sign-in', () => {
    let account = pendingAccount().approve(id, createdAt);
    account = account.recordFailedSignIn(createdAt);
    account = account.recordSuccessfulSignIn();
    expect(account.failedSignInCount).toBe(0);
    expect(account.lockedUntil).toBeNull();
  });
});

describe('Account roles', () => {
  function withRole(role: AccountRole, accountId: string): Account {
    const result = Account.register(
      { email: `${accountId}@sourceone.global`, firstName: 'Ada', lastName: 'Lovelace', passwordHash: 'hash', autoApprove: true, role },
      accountId,
      createdAt,
    );
    return result.value;
  }

  const staff = withRole('staff', 'staff-1');
  const admin = withRole('admin', 'admin-1');
  const systemAdmin = withRole('system-admin', 'system-1');

  it('registers as staff unless a role is given', () => {
    expect(pendingAccount().role).toBe('staff');
    expect(pendingAccount().isAdmin).toBe(false);
    expect(systemAdmin.role).toBe('system-admin');
  });

  it('counts an admin and a System Admin as admins, and only the second as a System Admin', () => {
    expect([admin.isAdmin, admin.isSystemAdmin]).toEqual([true, false]);
    expect([systemAdmin.isAdmin, systemAdmin.isSystemAdmin]).toEqual([true, true]);
  });

  it('lets an admin manage staff, but not another admin or a System Admin', () => {
    expect(admin.mayManage(staff)).toBe(true);
    expect(admin.mayManage(withRole('admin', 'admin-2'))).toBe(false);
    expect(admin.mayManage(systemAdmin)).toBe(false);
  });

  it('lets a System Admin manage anyone, and staff no one', () => {
    expect([staff, admin, withRole('system-admin', 'system-2')].every((target) => systemAdmin.mayManage(target))).toBe(true);
    expect(staff.mayManage(withRole('staff', 'staff-2'))).toBe(false);
  });

  it('lets only a System Admin change a role, and never their own', () => {
    expect(systemAdmin.mayChangeRoleOf(staff)).toBe(true);
    expect(systemAdmin.mayChangeRoleOf(withRole('system-admin', 'system-2'))).toBe(true);
    expect(systemAdmin.mayChangeRoleOf(systemAdmin)).toBe(false);
    expect(admin.mayChangeRoleOf(staff)).toBe(false);
  });

  it('changes the role and nothing else', () => {
    const promoted = staff.withRole('admin');
    expect(promoted.role).toBe('admin');
    expect(promoted.email).toBe(staff.email);
    expect(staff.role).toBe('staff');
  });
});
