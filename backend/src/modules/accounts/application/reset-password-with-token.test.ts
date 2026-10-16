import { describe, expect, it } from 'vitest';
import { FixedClock } from '../../../shared/application/testing/fakes.js';
import { Account } from '../domain/account.js';
import { ResetTokenInvalidError } from '../domain/account.errors.js';
import { InvalidPasswordError } from '../domain/password.js';
import { PasswordResetToken, RESET_TOKEN_TTL_MS } from '../domain/password-reset-token.js';
import { InMemoryAccountRepository } from './testing/in-memory-account-repository.js';
import { InMemoryPasswordResetTokenRepository } from './testing/in-memory-password-reset-token-repository.js';
import { FakePasswordHasher } from './testing/fake-password-hasher.js';
import { FakeTokenGenerator } from './testing/fake-token-generator.js';
import { ResetPasswordWithToken } from './reset-password-with-token.js';

const CREATED_AT = new Date('2026-10-16T00:00:00.000Z');

async function setup(now: Date, options?: { used?: boolean }) {
  const accounts = new InMemoryAccountRepository();
  const resetTokens = new InMemoryPasswordResetTokenRepository();
  const passwordHasher = new FakePasswordHasher();

  const registered = Account.register(
    { email: 'staff@sourceone.global', fullName: 'Staff Member', passwordHash: 'old-hash', autoApprove: true },
    'account-1',
    CREATED_AT,
  );
  if (!registered.ok) throw new Error('setup failed');
  await accounts.add(registered.value);

  let resetToken = PasswordResetToken.create('account-1', 'hash(token-1)', 'reset-1', CREATED_AT);
  if (options?.used) resetToken = resetToken.use(CREATED_AT);
  await resetTokens.add(resetToken);

  const useCase = new ResetPasswordWithToken(
    accounts,
    resetTokens,
    passwordHasher,
    new FakeTokenGenerator(),
    new FixedClock(now),
  );
  return { accounts, resetTokens, useCase };
}

describe('ResetPasswordWithToken', () => {
  it('sets the new password and clears must-change', async () => {
    const { accounts, useCase } = await setup(CREATED_AT);
    const result = await useCase.execute({ token: 'token-1', newPassword: 'new-password-456' });
    expect(result.ok).toBe(true);

    const [account] = await accounts.list();
    expect(account?.mustChangePassword).toBe(false);
    expect(await new FakePasswordHasher().verify('new-password-456', account!.passwordHash)).toBe(true);
  });

  it('consumes the token so a second use fails', async () => {
    const { resetTokens, useCase } = await setup(CREATED_AT);
    await useCase.execute({ token: 'token-1', newPassword: 'new-password-456' });
    const second = await useCase.execute({ token: 'token-1', newPassword: 'another-password-789' });
    expect(!second.ok && second.error).toBeInstanceOf(ResetTokenInvalidError);
    expect((await resetTokens.findByTokenHash('hash(token-1)'))?.usedAt).not.toBeNull();
  });

  it('rejects an already-used token', async () => {
    const { useCase } = await setup(CREATED_AT, { used: true });
    const result = await useCase.execute({ token: 'token-1', newPassword: 'new-password-456' });
    expect(!result.ok && result.error).toBeInstanceOf(ResetTokenInvalidError);
  });

  it('rejects an expired token', async () => {
    const afterExpiry = new Date(CREATED_AT.getTime() + RESET_TOKEN_TTL_MS + 1);
    const { useCase } = await setup(afterExpiry);
    const result = await useCase.execute({ token: 'token-1', newPassword: 'new-password-456' });
    expect(!result.ok && result.error).toBeInstanceOf(ResetTokenInvalidError);
  });

  it('rejects an unknown token', async () => {
    const { useCase } = await setup(CREATED_AT);
    const result = await useCase.execute({ token: 'unknown', newPassword: 'new-password-456' });
    expect(!result.ok && result.error).toBeInstanceOf(ResetTokenInvalidError);
  });

  it('rejects a new password that is too short', async () => {
    const { useCase } = await setup(CREATED_AT);
    const result = await useCase.execute({ token: 'token-1', newPassword: 'short' });
    expect(!result.ok && result.error).toBeInstanceOf(InvalidPasswordError);
  });
});
