import { err, ok, type Result } from '../../../../shared/domain/result.js';
import type { Account } from '../../domain/account.js';
import { AccountExistsError } from '../../domain/account.errors.js';
import type { AccountRepository } from '../../domain/account-repository.js';

/** The AccountRepository contract, in memory. A test double, never used in production. */
export class InMemoryAccountRepository implements AccountRepository {
  private readonly accounts: Account[] = [];

  async findById(id: string): Promise<Account | null> {
    return this.accounts.find((account) => account.id === id) ?? null;
  }

  async findByEmail(email: string): Promise<Account | null> {
    return this.accounts.find((account) => account.email === email) ?? null;
  }

  async add(account: Account): Promise<Result<void, AccountExistsError>> {
    const taken = this.accounts.some((existing) => existing.email === account.email);
    if (taken) return err(new AccountExistsError());
    this.accounts.push(account);
    return ok(undefined);
  }

  async save(account: Account): Promise<void> {
    const index = this.accounts.findIndex((existing) => existing.id === account.id);
    if (index === -1) throw new Error(`Account ${account.id} was never added.`);
    this.accounts[index] = account;
  }

  async list(): Promise<Account[]> {
    return [...this.accounts];
  }
}
