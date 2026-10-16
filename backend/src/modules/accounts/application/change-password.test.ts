import { describe, expect, it } from 'vitest';
import { FixedClock } from '../../../shared/application/testing/fakes.js';
import { Account } from '../domain/account.js';
import { SignInRequiredError, WrongCurrentPasswordError } from '../domain/account.errors.js';
import { InvalidPasswordError } from '../domain/password.js';
import { Session } from '../domain/session.js';
import { InMemoryAccountRepository } from './testing/in-memory-account-repository.js';
import { InMemorySessionRepository } from './testing/in-memory-session-repository.js';
import { FakePasswordHasher } from './testing/fake-password-hasher.js';
import { FakeTokenGenerator } from './testing/fake-token-generator.js';
import { ChangePassword } from './change-password.js';

const NOW = new Date('2026-10-16T08:00:00.000Z');

async function setup() {
  const accounts = new InMemoryAccountRepository();
  const sessions = new InMemorySessionRepository();
  const passwordHasher = new FakePasswordHasher();

  const result = Account.register(
    {
      email: 'staff@sourceone.global',
      fullName: 'Staff Member',
      passwordHash: await passwordHasher.hash('old-password-123'),
      autoApprove: true,
      mustChangePassword: true,
    },
    'account-1',
    NOW,
  );
  if (!result.ok) throw new Error('setup failed');
  await accounts.add(result.value);
  await sessions.add(Session.create(result.value.id, 'hash(token-1)', 'session-1', NOW));

  const changePassword = new ChangePassword(
    accounts,
    sessions,
    passwordHasher,
    new FakeTokenGenerator(),
    new FixedClock(NOW),
  );
  return { accounts, sessions, changePassword };
}

describe('ChangePassword', () => {
  it('changes the password and clears must-change', async () => {
    const { accounts, changePassword } = await setup();
    const result = await changePassword.execute({
      sessionToken: 'token-1',
      currentPassword: 'old-password-123',
      newPassword: 'new-password-456',
    });
    expect(result.ok).toBe(true);

    const [account] = await accounts.list();
    expect(account?.mustChangePassword).toBe(false);
    expect(await new FakePasswordHasher().verify('new-password-456', account!.passwordHash)).toBe(true);
  });

  it('rejects the wrong current password and changes nothing', async () => {
    const { accounts, changePassword } = await setup();
    const result = await changePassword.execute({
      sessionToken: 'token-1',
      currentPassword: 'totally-wrong-pw',
      newPassword: 'new-password-456',
    });
    expect(!result.ok && result.error).toBeInstanceOf(WrongCurrentPasswordError);
    const [account] = await accounts.list();
    expect(account?.mustChangePassword).toBe(true);
  });

  it('rejects a new password that is too short', async () => {
    const { changePassword } = await setup();
    const result = await changePassword.execute({
      sessionToken: 'token-1',
      currentPassword: 'old-password-123',
      newPassword: 'short',
    });
    expect(!result.ok && result.error).toBeInstanceOf(InvalidPasswordError);
  });

  it('fails without a valid session', async () => {
    const { changePassword } = await setup();
    const result = await changePassword.execute({
      sessionToken: 'unknown',
      currentPassword: 'old-password-123',
      newPassword: 'new-password-456',
    });
    expect(!result.ok && result.error).toBeInstanceOf(SignInRequiredError);
  });
});
