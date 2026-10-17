/** A public one-time link an admin sends to someone so they can create their account (ADR 0023). */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface AccountInviteProps {
  readonly id: string;
  /** Lower-cased, as `accounts.email`. The account it creates gets this email, whatever the request says. */
  readonly email: string;
  readonly tokenHash: string;
  /** The admin who invited. */
  readonly invitedBy: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly usedAt: Date | null;
  /** Set when an admin revokes it, or when a newer invite to the same email replaces it. */
  readonly revokedAt: Date | null;
}

export class AccountInvite {
  private constructor(private readonly props: AccountInviteProps) {}

  static create(email: string, tokenHash: string, invitedBy: string, id: string, now: Date): AccountInvite {
    return new AccountInvite({
      id,
      email,
      tokenHash,
      invitedBy,
      createdAt: now,
      expiresAt: new Date(now.getTime() + INVITE_TTL_MS),
      usedAt: null,
      revokedAt: null,
    });
  }

  /** Rebuilds an invite that was valid when it was stored. For persistence only. */
  static restore(props: AccountInviteProps): AccountInvite {
    return new AccountInvite(props);
  }

  get id(): string {
    return this.props.id;
  }

  get email(): string {
    return this.props.email;
  }

  get tokenHash(): string {
    return this.props.tokenHash;
  }

  get invitedBy(): string {
    return this.props.invitedBy;
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }

  get expiresAt(): Date {
    return new Date(this.props.expiresAt);
  }

  get usedAt(): Date | null {
    return this.props.usedAt ? new Date(this.props.usedAt) : null;
  }

  get revokedAt(): Date | null {
    return this.props.revokedAt ? new Date(this.props.revokedAt) : null;
  }

  /** Unused, unrevoked and not yet expired — the only state in which it may be redeemed. */
  isUsable(now: Date): boolean {
    return (
      this.props.usedAt === null
      && this.props.revokedAt === null
      && this.props.expiresAt.getTime() > now.getTime()
    );
  }

  use(now: Date): AccountInvite {
    return new AccountInvite({ ...this.props, usedAt: now });
  }

  revoke(now: Date): AccountInvite {
    return new AccountInvite({ ...this.props, revokedAt: now });
  }
}
