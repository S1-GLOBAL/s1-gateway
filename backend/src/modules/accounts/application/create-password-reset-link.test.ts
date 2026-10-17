import { describe, expect, it } from 'vitest';
import { FixedClock, SequentialIdGenerator } from '../../../shared/application/testing/fakes.js';
import { Account } from '../domain/account.js';
import { AccountNotFoundError } from '../domain/account.errors.js';
import { PasswordResetToken, RESET_TOKEN_TTL_MS } from '../domain/password-reset-token.js';
import { Session } from '../domain/session.js';
import { InMemoryAccountRepository } from './testing/in-memory-account-repository.js';
import { InMemoryPasswordResetTokenRepository } from './testing/in-memory-password-reset-token-repository.js';
import { InMemorySessionRepository } from './testing/in-memory-session-repository.js';
import { FakeTokenGenerator } from './testing/fake-token-generator.js';
import { CreatePasswordResetLink } from './create-password-reset-link.js';

const CREATED_AT = new Date('2026-10-16T00:00:00.000Z');
const NOW = new Date('2026-10-16T09:00:00.000Z');

async function setup() {
  const accounts = new InMemoryAccountRepository();
  const resetTokens = new InMemoryPasswordResetTokenRepository();
  const sessions = new InMemorySessionRepository();

  const registered = Account.register(
    { email: 'staff@sourceone.global', firstName: 'Staff', lastName: 'Member', passwordHash: 'hash', autoApprove: true },
    'account-1',
    CREATED_AT,
  );
  if (!registered.ok) throw new Error('setup failed');
  await accounts.add(registered.value);
  await sessions.add(Session.create('account-1', 'hash(session-token)', 'session-1', CREATED_AT));

  const useCase = new CreatePasswordResetLink(
    accounts,
    resetTokens,
    sessions,
    new FakeTokenGenerator(),
    new FixedClock(NOW),
    new SequentialIdGenerator(),
  );
  return { accounts, resetTokens, sessions, useCase };
}

describe('CreatePasswordResetLink', () => {
  it('creates a 24-hour token and reports it unhashed', async () => {
    const { useCase } = await setup();
    const result = await useCase.execute({ accountId: 'account-1' });
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.token).toBe('token-1');
    expect(result.ok && result.value.expiresAt).toBe(new Date(NOW.getTime() + RESET_TOKEN_TTL_MS).toISOString());
  });

  it('ends every open session for the account', async () => {
    const { sessions, useCase } = await setup();
    await useCase.execute({ accountId: 'account-1' });
    expect(await sessions.findByTokenHash('hash(session-token)')).toBeNull();
  });

  it('invalidates a prior unused token for the account', async () => {
    const { resetTokens, useCase } = await setup();
    const priorToken = PasswordResetToken.create('account-1', 'hash(old-token)', 'reset-0', CREATED_AT);
    await resetTokens.add(priorToken);

    await useCase.execute({ accountId: 'account-1' });

    expect(await resetTokens.findByTokenHash('hash(old-token)')).toBeNull();
  });

  it('fails for an unknown account', async () => {
    const accounts = new InMemoryAccountRepository();
    const resetTokens = new InMemoryPasswordResetTokenRepository();
    const sessions = new InMemorySessionRepository();
    const useCase = new CreatePasswordResetLink(
      accounts,
      resetTokens,
      sessions,
      new FakeTokenGenerator(),
      new FixedClock(NOW),
      new SequentialIdGenerator(),
    );
    const result = await useCase.execute({ accountId: 'unknown' });
    expect(!result.ok && result.error).toBeInstanceOf(AccountNotFoundError);
  });
});
