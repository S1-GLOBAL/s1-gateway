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

export class InvalidPersonNameError extends DomainError {
  override readonly code = 'VALIDATION_FAILED';

  constructor(field: 'firstName' | 'lastName', message: string) {
    super(message, { fields: { [field]: [message] } });
  }
}

export class PasswordsDontMatchError extends DomainError {
  override readonly code = 'VALIDATION_FAILED';

  constructor() {
    super("The passwords don't match.", { fields: { confirmPassword: ["The passwords don't match."] } });
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

/** The invite form's own wording: the admin is typing someone else's address. */
export class InviteEmailNotAllowedError extends DomainError {
  override readonly code = 'EMAIL_NOT_ALLOWED';

  constructor() {
    super('Use a @sourceone.global email address.', {
      fields: { email: ['Use a @sourceone.global email address.'] },
    });
  }
}

export class InviteAccountExistsError extends DomainError {
  override readonly code = 'ACCOUNT_EXISTS';

  constructor() {
    super('An account already exists for that email.', {
      fields: { email: ['An account already exists for that email.'] },
    });
  }
}

/** Expired, used, revoked and unknown all read the same, so a token's state can't be probed. */
export class InviteInvalidError extends DomainError {
  override readonly code = 'INVITE_INVALID';

  constructor() {
    super('This invite link no longer works.');
  }
}

export class InviteNotFoundError extends DomainError {
  override readonly code = 'INVITE_NOT_FOUND';

  constructor() {
    super('This invite was already used or revoked.');
  }
}
