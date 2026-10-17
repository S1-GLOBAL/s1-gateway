import type { Clock } from '../../../shared/application/ports/clock.js';
import type { IdGenerator } from '../../../shared/application/ports/id-generator.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import type { AccountRepository } from '../domain/account-repository.js';
import { InviteAccountExistsError, InviteEmailNotAllowedError } from '../domain/account.errors.js';
import { AccountInvite } from '../domain/account-invite.js';
import type { AccountInviteRepository } from '../domain/account-invite-repository.js';
import { normalizeCompanyEmail } from '../domain/email.js';
import type { TokenGenerator } from '../domain/token-generator.js';
import { toAccountInviteDto, type AccountInviteDto } from './account-invite.dto.js';

export interface CreateInviteInput {
  email: string;
  /** The id of the admin inviting. */
  invitedBy: string;
}

export interface CreateInviteOutput {
  invite: AccountInviteDto;
  /** The raw token for the admin's link. Never stored. */
  token: string;
}

export type CreateInviteError = InviteEmailNotAllowedError | InviteAccountExistsError;

export class CreateInvite implements UseCase<CreateInviteInput, Result<CreateInviteOutput, CreateInviteError>> {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly invites: AccountInviteRepository,
    private readonly tokens: TokenGenerator,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: CreateInviteInput): Promise<Result<CreateInviteOutput, CreateInviteError>> {
    // Lower-cased here, so the account check and the replacing of an open
    // invite both see one address however it was typed.
    const email = normalizeCompanyEmail(input.email);
    if (!email.ok) return err(new InviteEmailNotAllowedError());

    const existing = await this.accounts.findByEmail(email.value);
    if (existing) return err(new InviteAccountExistsError());

    const token = this.tokens.generate();
    const invite = AccountInvite.create(
      email.value,
      this.tokens.hash(token),
      input.invitedBy,
      this.ids.next(),
      this.clock.now(),
    );
    await this.invites.add(invite);

    return ok({ invite: toAccountInviteDto(invite), token });
  }
}
