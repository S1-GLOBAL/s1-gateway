import type { Result } from '../../../shared/domain/result.js';
import type { Account } from './account.js';
import type { AccountExistsError } from './account.errors.js';

/** Where accounts are kept. The domain owns this port; infrastructure implements it. */
export interface AccountRepository {
  findById(id: string): Promise<Account | null>;

  /** Looks up by the normalised (trimmed, lower-cased) email. */
  findByEmail(email: string): Promise<Account | null>;

  /** Fails with AccountExistsError when the email is already registered. */
  add(account: Account): Promise<Result<void, AccountExistsError>>;

  save(account: Account): Promise<void>;

  /** Every account, for the admin accounts page to group by status. */
  list(): Promise<Account[]>;
}
