import type { UseCase } from '../../../shared/application/use-case.js';
import type { AccountRepository } from '../domain/account-repository.js';

export interface SeedSystemAdminsInput {
  /** `ACCOUNT_ADMIN_EMAILS`, lower-cased, as the API reads it. */
  emails: readonly string[];
}

/**
 * Run as the API starts. While no account is a System Admin, each approved
 * account in the list becomes one: the first deploy turns the admins that
 * list named into System Admins, and an empty database gets its first. Once
 * one exists it does nothing, so a demotion in the app holds (ADR 0030).
 * Returns the emails it promoted.
 */
export class SeedSystemAdmins implements UseCase<SeedSystemAdminsInput, string[]> {
  constructor(private readonly accounts: AccountRepository) {}

  async execute(input: SeedSystemAdminsInput): Promise<string[]> {
    const all = await this.accounts.list();
    if (all.some((account) => account.isSystemAdmin && account.status === 'approved')) return [];

    const listed = all.filter((account) => account.status === 'approved' && input.emails.includes(account.email));
    for (const account of listed) await this.accounts.save(account.withRole('system-admin'));
    return listed.map((account) => account.email);
  }
}
