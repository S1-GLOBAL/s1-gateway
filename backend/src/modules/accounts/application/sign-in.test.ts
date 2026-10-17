import { describe, expect, it } from 'vitest';
import { FixedClock, SequentialIdGenerator } from '../../../shared/application/testing/fakes.js';
import { Account } from '../domain/account.js';
import {
  AccountDisabledError,
  AccountLockedError,
  AccountPendingError,
  SignInFailedError,
} from '../domain/account.errors.js';
import { InMemoryAccountRepository } from './testing/in-memory-account-repository.js';
import { InMemorySessionRepository } from './testing/in-memory-session-repository.js';
import { FakePasswordHasher } from './testing/fake-password-hasher.js';
import { FakeTokenGenerator } from './testing/fake-token-generator.js';
import { SignIn } from './sign-in.js';

const NOW = new Date('2026-10-16T08:00:00.000Z');
const EMAIL = 'staff@sourceone.global';
const PASSWORD = '123456789012';

/** One staff account, added straight to the repository: approved unless asked otherwise. */
async function addStaff(
  accounts: InMemoryAccountRepository,
  passwordHasher: FakePasswordHasher,
  ids: SequentialIdGenerator,
  createdAt: Date,
  approve = true,
): Promise<void> {
  const { value: account } = Account.register(
    {
      email: EMAIL,
      firstName: 'Staff',
      lastName: 'Member',
      passwordHash: await passwordHasher.hash(PASSWORD),
      autoApprove: approve,
    },
    ids.next(),
    createdAt,
  );
  await accounts.add(account);
}

async function setup(options?: { approve?: boolean }) {
  const accounts = new InMemoryAccountRepository();
  const sessions = new InMemorySessionRepository();
  const passwordHasher = new FakePasswordHasher();
  const clock = new FixedClock(NOW);
  const ids = new SequentialIdGenerator();

  await addStaff(accounts, passwordHasher, ids, NOW, options?.approve !== false);

  const signIn = new SignIn(accounts, sessions, passwordHasher, new FakeTokenGenerator(), clock, ids);
  return { accounts, sessions, signIn, clock };
}

describe('SignIn', () => {
  it('signs in an approved account and starts a session', async () => {
    const { signIn, sessions } = await setup();
    const result = await signIn.execute({ email: EMAIL, password: PASSWORD });
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.account.email).toBe(EMAIL);
    expect(result.ok && result.value.sessionToken).toBe('token-1');
    expect((await sessions.findByTokenHash('hash(token-1)'))?.accountId).toBe(result.ok ? result.value.account.id : undefined);
  });

  it('rejects an unknown email without revealing it', async () => {
    const { signIn } = await setup();
    const result = await signIn.execute({ email: 'nobody@sourceone.global', password: PASSWORD });
    expect(!result.ok && result.error).toBeInstanceOf(SignInFailedError);
  });

  it('rejects the wrong password', async () => {
    const { signIn } = await setup();
    const result = await signIn.execute({ email: EMAIL, password: 'wrong-password' });
    expect(!result.ok && result.error).toBeInstanceOf(SignInFailedError);
  });

  it('rejects a pending account and starts no session', async () => {
    const { signIn, sessions } = await setup({ approve: false });
    const result = await signIn.execute({ email: EMAIL, password: PASSWORD });
    expect(!result.ok && result.error).toBeInstanceOf(AccountPendingError);
    expect(await sessions.findByTokenHash('hash(token-1)')).toBeNull();
  });

  it('rejects a disabled account', async () => {
    const { signIn, accounts } = await setup();
    const [account] = await accounts.list();
    await accounts.save(account!.disable());
    const result = await signIn.execute({ email: EMAIL, password: PASSWORD });
    expect(!result.ok && result.error).toBeInstanceOf(AccountDisabledError);
  });

  it('locks the account on the fifth wrong password and reports it on the triggering attempt', async () => {
    const { signIn } = await setup();
    for (let i = 0; i < 4; i += 1) {
      const result = await signIn.execute({ email: EMAIL, password: 'wrong-password' });
      expect(!result.ok && result.error).toBeInstanceOf(SignInFailedError);
    }
    const fifth = await signIn.execute({ email: EMAIL, password: 'wrong-password' });
    expect(!fifth.ok && fifth.error).toBeInstanceOf(AccountLockedError);
  });

  it('refuses sign-in while locked, even with the correct password', async () => {
    const { signIn } = await setup();
    for (let i = 0; i < 5; i += 1) await signIn.execute({ email: EMAIL, password: 'wrong-password' });
    const result = await signIn.execute({ email: EMAIL, password: PASSWORD });
    expect(!result.ok && result.error).toBeInstanceOf(AccountLockedError);
  });

  it('accepts the correct password after the fifteen-minute lock ends', async () => {
    const accounts = new InMemoryAccountRepository();
    const sessions = new InMemorySessionRepository();
    const passwordHasher = new FakePasswordHasher();
    const ids = new SequentialIdGenerator();
    const lockedAt = NOW;
    const afterLock = new Date(NOW.getTime() + 15 * 60_000);

    await addStaff(accounts, passwordHasher, ids, lockedAt);

    const lockedSignIn = new SignIn(
      accounts,
      sessions,
      passwordHasher,
      new FakeTokenGenerator(),
      new FixedClock(lockedAt),
      ids,
    );
    for (let i = 0; i < 5; i += 1) await lockedSignIn.execute({ email: EMAIL, password: 'wrong-password' });

    const after = new SignIn(
      accounts,
      sessions,
      passwordHasher,
      new FakeTokenGenerator(),
      new FixedClock(afterLock),
      ids,
    );
    const result = await after.execute({ email: EMAIL, password: PASSWORD });
    expect(result.ok).toBe(true);
  });

  it('clears the failure count after a successful sign-in', async () => {
    const { signIn, accounts } = await setup();
    await signIn.execute({ email: EMAIL, password: 'wrong-password' });
    await signIn.execute({ email: EMAIL, password: PASSWORD });
    const [account] = await accounts.list();
    expect(account?.failedSignInCount).toBe(0);
  });
});
