import type { Clock } from '../../../shared/application/ports/clock.js';
import type { IdGenerator } from '../../../shared/application/ports/id-generator.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import { Account } from '../domain/account.js';
import {
  type AccountExistsError,
  type InvalidPasswordError,
  type InvalidPersonNameError,
  InviteInvalidError,
  type PasswordsDontMatchError,
} from '../domain/account.errors.js';
import type { AccountInviteRepository } from '../domain/account-invite-repository.js';
import { checkPasswordsMatch, validatePassword } from '../domain/password.js';
import type { PasswordHasher } from '../domain/password-hasher.js';
import { normalizeFirstName, normalizeLastName } from '../domain/person-name.js';
import type { TokenGenerator } from '../domain/token-generator.js';
import { toAccountDto, type AccountDto } from './account.dto.js';

export interface RegisterWithInviteInput {
  /** The raw token from the invite link. */
  token: string;
  firstName: string;
  lastName: string;
  password: string;
  confirmPassword: string;
}

export type RegisterWithInviteError =
  | InviteInvalidError
  | InvalidPersonNameError
  | InvalidPasswordError
  | PasswordsDontMatchError
  | AccountExistsError;

/** Someone an admin invited creates their account: approved at once, with the invite's email (ADR 0023). */
export class RegisterWithInvite
  implements UseCase<RegisterWithInviteInput, Result<AccountDto, RegisterWithInviteError>>
{
  constructor(
    private readonly invites: AccountInviteRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokens: TokenGenerator,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: RegisterWithInviteInput): Promise<Result<AccountDto, RegisterWithInviteError>> {
    const invite = await this.invites.findByTokenHash(this.tokens.hash(input.token));
    const now = this.clock.now();
    if (!invite || !invite.isUsable(now)) return err(new InviteInvalidError());

    const firstName = normalizeFirstName(input.firstName);
    if (!firstName.ok) return firstName;

    const lastName = normalizeLastName(input.lastName);
    if (!lastName.ok) return lastName;

    const password = validatePassword(input.password);
    if (!password.ok) return password;

    const confirmed = checkPasswordsMatch(input.password, input.confirmPassword);
    if (!confirmed.ok) return confirmed;

    const passwordHash = await this.passwordHasher.hash(password.value);
    const account = Account.registerInvited(
      {
        email: invite.email,
        firstName: firstName.value,
        lastName: lastName.value,
        passwordHash,
        invitedBy: invite.invitedBy,
      },
      this.ids.next(),
      now,
    );

    // The repository settles the rest atomically: an invite used or revoked
    // since it was read above answers INVITE_INVALID, and an account created
    // for this email since the invite answers ACCOUNT_EXISTS, leaving the
    // invite unused. Neither is checked here first, so a lost race on one
    // token always reads as INVITE_INVALID.
    const redeemed = await this.invites.redeem(invite.id, account, now);
    if (!redeemed.ok) return redeemed;

    return ok(toAccountDto(account));
  }
}
