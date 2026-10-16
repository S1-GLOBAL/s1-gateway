import type { Session } from '../../domain/session.js';
import type { SessionRepository } from '../../domain/session-repository.js';

/** The SessionRepository contract, in memory. A test double, never used in production. */
export class InMemorySessionRepository implements SessionRepository {
  private readonly sessions: Session[] = [];

  async add(session: Session): Promise<void> {
    this.sessions.push(session);
  }

  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    return this.sessions.find((session) => session.tokenHash === tokenHash) ?? null;
  }

  async save(session: Session): Promise<void> {
    const index = this.sessions.findIndex((existing) => existing.id === session.id);
    if (index === -1) throw new Error(`Session ${session.id} was never added.`);
    this.sessions[index] = session;
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    const index = this.sessions.findIndex((session) => session.tokenHash === tokenHash);
    if (index !== -1) this.sessions.splice(index, 1);
  }

  async deleteByAccountId(accountId: string): Promise<void> {
    for (let i = this.sessions.length - 1; i >= 0; i -= 1) {
      if (this.sessions[i]?.accountId === accountId) this.sessions.splice(i, 1);
    }
  }
}
