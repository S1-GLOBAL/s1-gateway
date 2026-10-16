import type { UseCase } from '../../../shared/application/use-case.js';
import type { SessionRepository } from '../domain/session-repository.js';
import type { TokenGenerator } from '../domain/token-generator.js';

export interface SignOutInput {
  /** The raw session token from the cookie. Missing or already-gone is not an error. */
  sessionToken: string;
}

export class SignOut implements UseCase<SignOutInput, void> {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly tokens: TokenGenerator,
  ) {}

  async execute(input: SignOutInput): Promise<void> {
    await this.sessions.deleteByTokenHash(this.tokens.hash(input.sessionToken));
  }
}
