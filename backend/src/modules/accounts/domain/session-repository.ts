import type { Session } from './session.js';

/** Where sessions are kept. The domain owns this port; infrastructure implements it. */
export interface SessionRepository {
  add(session: Session): Promise<void>;

  findByTokenHash(tokenHash: string): Promise<Session | null>;

  save(session: Session): Promise<void>;

  deleteByTokenHash(tokenHash: string): Promise<void>;

  /** Ends every open session for an account — on disable, password change, reset link, and reset redeem. */
  deleteByAccountId(accountId: string): Promise<void>;
}
