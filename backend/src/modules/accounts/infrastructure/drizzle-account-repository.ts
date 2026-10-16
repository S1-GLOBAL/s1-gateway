import { eq } from 'drizzle-orm';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import type { Database } from '../../../shared/infrastructure/database/connection.js';
import { isUniqueViolation } from '../../../shared/infrastructure/database/postgres-errors.js';
import type { Account } from '../domain/account.js';
import { AccountExistsError } from '../domain/account.errors.js';
import type { AccountRepository } from '../domain/account-repository.js';
import { accounts } from './accounts.table.js';
import { toDomain, toRow } from './account.mapper.js';

export class DrizzleAccountRepository implements AccountRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Account | null> {
    const [row] = await this.db.select().from(accounts).where(eq(accounts.id, id));
    return row ? toDomain(row) : null;
  }

  async findByEmail(email: string): Promise<Account | null> {
    const [row] = await this.db.select().from(accounts).where(eq(accounts.email, email));
    return row ? toDomain(row) : null;
  }

  async add(account: Account): Promise<Result<void, AccountExistsError>> {
    try {
      await this.db.insert(accounts).values(toRow(account));
      return ok(undefined);
    } catch (error) {
      if (isUniqueViolation(error)) return err(new AccountExistsError());
      throw error;
    }
  }

  async save(account: Account): Promise<void> {
    await this.db.update(accounts).set(toRow(account)).where(eq(accounts.id, account.id));
  }

  async list(): Promise<Account[]> {
    const rows = await this.db.select().from(accounts);
    return rows.map(toDomain);
  }
}
