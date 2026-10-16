/** A public one-time link an admin gives a staff member in person. */
export const RESET_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export interface PasswordResetTokenProps {
  readonly id: string;
  readonly accountId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly usedAt: Date | null;
  readonly createdAt: Date;
}

export class PasswordResetToken {
  private constructor(private readonly props: PasswordResetTokenProps) {}

  static create(accountId: string, tokenHash: string, id: string, createdAt: Date): PasswordResetToken {
    return new PasswordResetToken({
      id,
      accountId,
      tokenHash,
      expiresAt: new Date(createdAt.getTime() + RESET_TOKEN_TTL_MS),
      usedAt: null,
      createdAt,
    });
  }

  /** Rebuilds a token that was valid when it was stored. For persistence only. */
  static restore(props: PasswordResetTokenProps): PasswordResetToken {
    return new PasswordResetToken(props);
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

  get usedAt(): Date | null {
    return this.props.usedAt ? new Date(this.props.usedAt) : null;
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }

  /** Unused and not yet expired — the only state in which it may be redeemed. */
  isUsable(now: Date): boolean {
    return this.props.usedAt === null && this.props.expiresAt.getTime() > now.getTime();
  }

  use(now: Date): PasswordResetToken {
    return new PasswordResetToken({ ...this.props, usedAt: now });
  }
}
