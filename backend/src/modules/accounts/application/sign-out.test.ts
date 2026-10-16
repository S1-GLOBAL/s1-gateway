import { describe, expect, it } from 'vitest';
import { Session } from '../domain/session.js';
import { InMemorySessionRepository } from './testing/in-memory-session-repository.js';
import { FakeTokenGenerator } from './testing/fake-token-generator.js';
import { SignOut } from './sign-out.js';

describe('SignOut', () => {
  it('ends the session for the given token', async () => {
    const sessions = new InMemorySessionRepository();
    const tokens = new FakeTokenGenerator();
    await sessions.add(Session.create('account-1', 'hash(token-1)', 'session-1', new Date()));

    await new SignOut(sessions, tokens).execute({ sessionToken: 'token-1' });

    expect(await sessions.findByTokenHash('hash(token-1)')).toBeNull();
  });

  it('is a no-op when the token matches no session', async () => {
    const sessions = new InMemorySessionRepository();
    await expect(
      new SignOut(sessions, new FakeTokenGenerator()).execute({ sessionToken: 'unknown' }),
    ).resolves.toBeUndefined();
  });
});
