import { DomainError } from '../../../shared/domain/domain-error.js';

export class EmailNotAllowedError extends DomainError {
  override readonly code = 'EMAIL_NOT_ALLOWED';

  constructor() {
    super('Use your @sourceone.global email address.');
  }
}

export class InvalidPasswordError extends DomainError {
  override readonly code = 'VALIDATION_FAILED';

  constructor(message: string) {
    super(message, { fields: { password: [message] } });
  }
}

export class InvalidFullNameError extends DomainError {
  override readonly code = 'VALIDATION_FAILED';

  constructor(message: string) {
    super(message, { fields: { fullName: [message] } });
  }
}

export class AccountExistsError extends DomainError {
  override readonly code = 'ACCOUNT_EXISTS';

  constructor() {
    super(
      'An account with this email already exists. Sign in instead, or ask reyxdz to reset your password.',
    );
  }
}

export class SignInFailedError extends DomainError {
  override readonly code = 'SIGN_IN_FAILED';

  constructor() {
    super("That email and password don't match.");
  }
}

export class AccountPendingError extends DomainError {
  override readonly code = 'ACCOUNT_PENDING';

  constructor() {
    super('Your account is waiting for approval by reyxdz.');
  }
}

export class AccountDisabledError extends DomainError {
  override readonly code = 'ACCOUNT_DISABLED';

  constructor() {
    super('This account has been disabled. Ask reyxdz if you think this is wrong.');
  }
}

export class AccountLockedError extends DomainError {
  override readonly code = 'ACCOUNT_LOCKED';

  constructor() {
    super('Too many wrong passwords. Try again in 15 minutes.');
  }
}

export class MustChangePasswordError extends DomainError {
  override readonly code = 'MUST_CHANGE_PASSWORD';

  constructor() {
    super('Choose a new password before you continue.');
  }
}

export class SignInRequiredError extends DomainError {
  override readonly code = 'SIGN_IN_REQUIRED';

  constructor() {
    super('Your session ended. Sign in again.');
  }
}

export class NotAllowedError extends DomainError {
  override readonly code = 'NOT_ALLOWED';

  constructor() {
    super('You are not allowed to do that.');
  }
}

export class ResetTokenInvalidError extends DomainError {
  override readonly code = 'RESET_TOKEN_INVALID';

  constructor() {
    super('This link is invalid or has expired. Ask reyxdz for a new one.');
  }
}

export class SignUpRateLimitedError extends DomainError {
  override readonly code = 'SIGN_UP_RATE_LIMITED';

  constructor() {
    super('Too many accounts were created from here. Try again in an hour.');
  }
}

export class WrongCurrentPasswordError extends DomainError {
  override readonly code = 'VALIDATION_FAILED';

  constructor() {
    super('That password is incorrect.', { fields: { currentPassword: ['That password is incorrect.'] } });
  }
}

export class AccountNotFoundError extends DomainError {
  override readonly code = 'ACCOUNT_NOT_FOUND';

  constructor() {
    super('Account not found.');
  }
}
