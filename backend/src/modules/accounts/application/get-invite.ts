import type { Clock } from '../../../shared/application/ports/clock.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import { InviteInvalidError } from '../domain/account.errors.js';
import type { AccountInviteRepository } from '../domain/account-invite-repository.js';
import type { TokenGenerator } from '../domain/token-generator.js';
import type { InviteDetailsDto } from './account-invite.dto.js';

export interface GetInviteInput {
  /** The raw token from the invite link. */
  token: string;
}

export class GetInvite implements UseCase<GetInviteInput, Result<InviteDetailsDto, InviteInvalidError>> {
  constructor(
    private readonly invites: AccountInviteRepository,
    private readonly tokens: TokenGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: GetInviteInput): Promise<Result<InviteDetailsDto, InviteInvalidError>> {
    const invite = await this.invites.findByTokenHash(this.tokens.hash(input.token));
    if (!invite || !invite.isUsable(this.clock.now())) return err(new InviteInvalidError());
    return ok({ email: invite.email, expiresAt: invite.expiresAt.toISOString() });
  }
}
