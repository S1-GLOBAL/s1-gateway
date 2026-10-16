export type AccountStatus = 'pending' | 'approved' | 'disabled';

export const FAILED_SIGN_IN_LIMIT = 5;
export const LOCKOUT_MINUTES = 15;

export interface AccountProps {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;
  readonly passwordHash: string;
  readonly mustChangePassword: boolean;
  readonly status: AccountStatus;
  readonly failedSignInCount: number;
  readonly lockedUntil: Date | null;
  readonly createdAt: Date;
  readonly approvedBy: string | null;
  readonly approvedAt: Date | null;
}

export interface RegisterAccountInput {
  email: string;
  fullName: string;
  passwordHash: string;
  autoApprove: boolean;
  mustChangePassword?: boolean;
}

/** A staff member who may use the Gateway once approved. */
export class Account {
  private constructor(private readonly props: AccountProps) {}

  static register(input: RegisterAccountInput, id: string, createdAt: Date): { ok: true; value: Account } {
    const approved = input.autoApprove;
    return {
      ok: true,
      value: new Account({
        id,
        email: input.email,
        fullName: input.fullName,
        passwordHash: input.passwordHash,
        mustChangePassword: input.mustChangePassword ?? false,
        status: approved ? 'approved' : 'pending',
        failedSignInCount: 0,
        lockedUntil: null,
        createdAt,
        approvedBy: approved ? id : null,
        approvedAt: approved ? createdAt : null,
      }),
    };
  }

  /** Rebuilds an account that was valid when it was stored. For persistence only. */
  static restore(props: AccountProps): Account {
    return new Account(props);
  }

  get id(): string {
    return this.props.id;
  }

  get email(): string {
    return this.props.email;
  }

  get fullName(): string {
    return this.props.fullName;
  }

  get passwordHash(): string {
    return this.props.passwordHash;
  }

  get mustChangePassword(): boolean {
    return this.props.mustChangePassword;
  }

  get status(): AccountStatus {
    return this.props.status;
  }

  get failedSignInCount(): number {
    return this.props.failedSignInCount;
  }

  get lockedUntil(): Date | null {
    return this.props.lockedUntil ? new Date(this.props.lockedUntil) : null;
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }

  get approvedBy(): string | null {
    return this.props.approvedBy;
  }

  get approvedAt(): Date | null {
    return this.props.approvedAt ? new Date(this.props.approvedAt) : null;
  }

  isLocked(now: Date): boolean {
    return this.props.lockedUntil !== null && this.props.lockedUntil.getTime() > now.getTime();
  }

  approve(approvedBy: string, approvedAt: Date): Account {
    return new Account({
      ...this.props,
      status: 'approved',
      approvedBy,
      approvedAt,
    });
  }

  disable(): Account {
    return new Account({
      ...this.props,
      status: 'disabled',
    });
  }

  withPasswordHash(passwordHash: string, options?: { clearMustChange?: boolean }): Account {
    return new Account({
      ...this.props,
      passwordHash,
      mustChangePassword: options?.clearMustChange ? false : this.props.mustChangePassword,
      failedSignInCount: 0,
      lockedUntil: null,
    });
  }

  requirePasswordChange(): Account {
    return new Account({ ...this.props, mustChangePassword: true });
  }

  recordFailedSignIn(now: Date): Account {
    const failedSignInCount = this.props.failedSignInCount + 1;
    const lockedUntil =
      failedSignInCount >= FAILED_SIGN_IN_LIMIT
        ? new Date(now.getTime() + LOCKOUT_MINUTES * 60_000)
        : this.props.lockedUntil;
    return new Account({ ...this.props, failedSignInCount, lockedUntil });
  }

  recordSuccessfulSignIn(): Account {
    return new Account({
      ...this.props,
      failedSignInCount: 0,
      lockedUntil: null,
    });
  }
}
