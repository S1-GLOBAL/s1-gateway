import type { Clock } from '../../../shared/application/ports/clock.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import type { AccountInviteRepository } from '../domain/account-invite-repository.js';
import { toAccountInviteDto, type AccountInviteDto } from './account-invite.dto.js';

/** The invites still waiting to be used, newest first, for the Invited section. */
export class ListInvites implements UseCase<void, AccountInviteDto[]> {
  constructor(
    private readonly invites: AccountInviteRepository,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<AccountInviteDto[]> {
    const open = await this.invites.listOpen(this.clock.now());
    return open.map(toAccountInviteDto);
  }
}
