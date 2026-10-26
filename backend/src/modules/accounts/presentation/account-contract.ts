import type { Account as AccountContract } from '../../../contracts/accounts.js';
import type { AccountDto } from '../application/account.dto.js';

export function toAccountContract(account: AccountDto): AccountContract {
  return { ...account, isAdmin: account.role !== 'staff' };
}
