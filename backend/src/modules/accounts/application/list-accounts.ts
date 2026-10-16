import type { UseCase } from '../../../shared/application/use-case.js';
import type { AccountRepository } from '../domain/account-repository.js';
import { toAccountDto, type AccountDto } from './account.dto.js';

export interface AccountsByStatus {
  pending: AccountDto[];
  approved: AccountDto[];
  disabled: AccountDto[];
}

export class ListAccounts implements UseCase<void, AccountsByStatus> {
  constructor(private readonly accounts: AccountRepository) {}

  async execute(): Promise<AccountsByStatus> {
    const accounts = (await this.accounts.list())
      .slice()
      .sort((a, b) => compareText(a.fullName, b.fullName) || compareText(a.email, b.email))
      .map(toAccountDto);

    return {
      pending: accounts.filter((account) => account.status === 'pending'),
      approved: accounts.filter((account) => account.status === 'approved'),
      disabled: accounts.filter((account) => account.status === 'disabled'),
    };
  }
}

function compareText(a: string, b: string): number {
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
