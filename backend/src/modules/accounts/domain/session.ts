/** A signed-in staff member's session. Renewing extends it; it never outlives its token. */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface SessionProps {
  readonly id: string;
  readonly accountId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly lastSeenAt: Date;
  readonly createdAt: Date;
}

export class Session {
  private constructor(private readonly props: SessionProps) {}

  static create(accountId: string, tokenHash: string, id: string, createdAt: Date): Session {
    return new Session({
      id,
      accountId,
      tokenHash,
      expiresAt: new Date(createdAt.getTime() + SESSION_TTL_MS),
      lastSeenAt: createdAt,
      createdAt,
    });
  }

  /** Rebuilds a session that was valid when it was stored. For persistence only. */
  static restore(props: SessionProps): Session {
    return new Session(props);
  }

  get id(): string {
    return this.props.id;
  }

  get accountId(): string {
    return this.props.accountId;
  }

  get tokenHash(): string {
    return this.props.tokenHash;
  }

  get expiresAt(): Date {
    return new Date(this.props.expiresAt);
  }

  get lastSeenAt(): Date {
    return new Date(this.props.lastSeenAt);
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }

  isExpired(now: Date): boolean {
    return this.props.expiresAt.getTime() <= now.getTime();
  }

  /** Pushes expiry out another full TTL and records this request as the last seen. */
  renew(now: Date): Session {
    return new Session({
      ...this.props,
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
      lastSeenAt: now,
    });
  }
}
