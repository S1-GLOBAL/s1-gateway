import type { Clock } from '../../../shared/application/ports/clock.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { ok, type Result } from '../../../shared/domain/result.js';
import type { InviteNotFoundError } from '../domain/account.errors.js';
import type { AccountInviteRepository } from '../domain/account-invite-repository.js';
import { toAccountInviteDto, type AccountInviteDto } from './account-invite.dto.js';

export interface RevokeInviteInput {
  inviteId: string;
}

export class RevokeInvite implements UseCase<RevokeInviteInput, Result<AccountInviteDto, InviteNotFoundError>> {
  constructor(
    private readonly invites: AccountInviteRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: RevokeInviteInput): Promise<Result<AccountInviteDto, InviteNotFoundError>> {
    // Only an open invite is revoked: one used, revoked or unknown — perhaps
    // by a race with the person registering — is reported, not overwritten.
    const revoked = await this.invites.revoke(input.inviteId, this.clock.now());
    if (!revoked.ok) return revoked;
    return ok(toAccountInviteDto(revoked.value));
  }
}
