import { describe, expect, it } from 'vitest';
import { FixedClock, SequentialIdGenerator } from '../../../shared/application/testing/fakes.js';
import { AccountExistsError, SignUpRateLimitedError } from '../domain/account.errors.js';
import { EmailNotAllowedError } from '../domain/email.js';
import { InvalidFullNameError } from '../domain/full-name.js';
import { InvalidPasswordError } from '../domain/password.js';
import { InMemoryAccountRepository } from './testing/in-memory-account-repository.js';
import { InMemorySignUpRateLimiter } from './testing/in-memory-sign-up-rate-limiter.js';
import { FakePasswordHasher } from './testing/fake-password-hasher.js';
import { SignUp } from './sign-up.js';

const NOW = new Date('2026-10-16T08:00:00.000Z');

function setup(adminEmails: readonly string[] = []) {
  const accounts = new InMemoryAccountRepository();
  const rateLimiter = new InMemorySignUpRateLimiter();
  const signUp = new SignUp(
    accounts,
    rateLimiter,
    new FakePasswordHasher(),
    new FixedClock(NOW),
    new SequentialIdGenerator(),
    adminEmails,
  );
  return { accounts, rateLimiter, signUp };
}

const input = { email: 'staff@sourceone.global', fullName: 'Staff Member', password: '123456789012', clientIp: '1.1.1.1' };

describe('SignUp', () => {
  it('registers as pending by default', async () => {
    const { signUp } = setup();
    const result = await signUp.execute(input);
    expect(result).toEqual({
      ok: true,
      value: {
        id: '00000000-0000-4000-8000-000000000001',
        email: 'staff@sourceone.global',
        fullName: 'Staff Member',
        status: 'pending',
        mustChangePassword: false,
        createdAt: NOW.toISOString(),
      },
    });
  });

  it('auto-approves an admin email', async () => {
    const { signUp } = setup(['staff@sourceone.global']);
    const result = await signUp.execute(input);
    expect(result.ok && result.value.status).toBe('approved');
  });

  it('rejects a non-company email and stores nothing', async () => {
    const { accounts, signUp } = setup();
    const result = await signUp.execute({ ...input, email: 'staff@gmail.com' });
    expect(!result.ok && result.error).toBeInstanceOf(EmailNotAllowedError);
    expect(await accounts.list()).toEqual([]);
  });

  it('rejects a short password', async () => {
    const { signUp } = setup();
    const result = await signUp.execute({ ...input, password: 'short' });
    expect(!result.ok && result.error).toBeInstanceOf(InvalidPasswordError);
  });

  it('rejects an empty full name', async () => {
    const { signUp } = setup();
    const result = await signUp.execute({ ...input, fullName: '  ' });
    expect(!result.ok && result.error).toBeInstanceOf(InvalidFullNameError);
  });

  it('rejects a second sign-up with the same email, ignoring case', async () => {
    const { accounts, signUp } = setup();
    await signUp.execute(input);
    const result = await signUp.execute({ ...input, email: 'STAFF@sourceone.global' });
    expect(!result.ok && result.error).toBeInstanceOf(AccountExistsError);
    expect(await accounts.list()).toHaveLength(1);
  });

  it('stores the password hashed through the password hasher port, never raw', async () => {
    const { accounts, signUp } = setup();
    await signUp.execute(input);
    const [stored] = await accounts.list();
    expect(stored?.passwordHash).not.toBe(input.password);
    expect(stored?.passwordHash).toBe(await new FakePasswordHasher().hash(input.password));
  });

  it('allows five sign-ups from the same IP within an hour, and refuses the sixth', async () => {
    const { signUp } = setup();
    for (let i = 0; i < 5; i += 1) {
      const result = await signUp.execute({ ...input, email: `staff${i}@sourceone.global` });
      expect(result.ok).toBe(true);
    }
    const result = await signUp.execute({ ...input, email: 'staff5@sourceone.global' });
    expect(!result.ok && result.error).toBeInstanceOf(SignUpRateLimitedError);
  });

  it('does not consume the rate limit for a sign-up that fails validation', async () => {
    const { signUp } = setup();
    await signUp.execute({ ...input, password: 'short' });
    for (let i = 0; i < 5; i += 1) {
      const result = await signUp.execute({ ...input, email: `staff${i}@sourceone.global` });
      expect(result.ok).toBe(true);
    }
  });
});
